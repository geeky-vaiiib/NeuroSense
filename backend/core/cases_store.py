"""Case storage helpers for category-aware screening records.

Public API is identical to the previous file-based implementation so that
all routers (cases.py, screening.py, explainability.py) require zero changes.

Persistence layer: MongoDB Atlas via pymongo.
All documents are stored in the ``cases`` collection.  The ``_id`` field
inserted by MongoDB is stripped before records are returned to callers.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .categories import (
    build_case_tags,
    build_diagnosis_summary,
    build_initial_notes,
    build_interpretation,
    category_label,
    default_respondent_relationship,
    derive_category_from_age,
    modality_confidence_for_category,
    screening_tool_for_category,
    validate_age_for_category,
)
from .database import get_cases_collection


# ── Internal helpers ──────────────────────────────────────────────────────────

def _first(record: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return default


def _iso_date(value: Any) -> str:
    if not value:
        return ""
    return str(value)[:10]


def _strip_mongo_id(doc: dict[str, Any]) -> dict[str, Any]:
    """Remove the ``_id`` field that MongoDB inserts so callers never see it."""
    doc.pop("_id", None)
    return doc


# ── Normalisation (unchanged logic) ──────────────────────────────────────────

def normalize_case_record(record: dict[str, Any]) -> dict[str, Any]:
    """Normalize mixed legacy/mock records into the canonical case shape."""
    demo_raw = deepcopy(_first(record, "demo", default={}) or {})
    answers = deepcopy(_first(record, "answers", default={}) or {})

    age = int(_first(record, "age", default=demo_raw.get("age", 18)) or 18)
    category = str(_first(record, "category", default=derive_category_from_age(age)))
    try:
        validate_age_for_category(category, age)
    except ValueError:
        category = derive_category_from_age(age)

    subject_name = _first(
        record,
        "subject_name",
        "subjectName",
        "patientName",
        default=demo_raw.get("subjectName")
        or demo_raw.get("name")
        or f"{category_label(category)} screening case",
    )
    respondent_name = _first(
        record,
        "respondent_name",
        "respondentName",
        default=demo_raw.get("respondentName") or subject_name,
    )
    respondent_relationship = _first(
        record,
        "respondent_relationship",
        "respondentRelationship",
        default=demo_raw.get("respondentRelationship")
        or default_respondent_relationship(category),
    )
    gender = _first(record, "gender", default=demo_raw.get("gender", "Prefer not to say"))
    ethnicity = _first(record, "ethnicity", default=demo_raw.get("ethnicity"))
    jaundice = _first(record, "jaundice", default=demo_raw.get("jaundice"))
    family_asd = _first(
        record,
        "family_asd",
        "familyAsd",
        default=demo_raw.get("familyAsd") or demo_raw.get("family_asd"),
    )

    risk_level = str(_first(record, "risk_level", "riskLevel", default="Low"))
    risk_score = float(_first(record, "risk_score", "riskScore", default=0.0) or 0.0)
    aq10_score = int(_first(record, "aq10_score", "aq10Score", default=0) or 0)

    created_at = str(_first(record, "created_at", "createdAt", default=""))
    updated_at = str(_first(record, "updated_at", "updatedAt", default=created_at))
    screening_date = _iso_date(
        _first(record, "screening_date", "screeningDate", default=created_at)
    )
    referral_date = _iso_date(_first(record, "referral_date", "referralDate", default=""))

    model_used = str(_first(record, "model_used", "modelUsed", default=f"{category}_MockProxy"))
    if "is_mock" in record:
        is_mock = bool(record["is_mock"])
    elif "isMock" in record:
        is_mock = bool(record["isMock"])
    else:
        is_mock = "Mock" in model_used
    data_source = str(
        _first(record, "data_source", "dataSource", default="mock" if is_mock else "model")
    )

    screening_tool = str(
        _first(
            record,
            "screening_tool",
            "screeningTool",
            default=screening_tool_for_category(category),
        )
    )
    completed_screenings = list(
        _first(
            record,
            "completed_screenings",
            "completedScreenings",
            default=[screening_tool],
        )
        or [screening_tool]
    )
    tags = list(_first(record, "tags", default=[]) or [])
    if not tags:
        tags = build_case_tags(category, risk_level, is_mock)

    interpretation = str(
        _first(record, "interpretation", default=build_interpretation(category, risk_level))
    )
    diagnosis = str(
        _first(record, "diagnosis", default=build_diagnosis_summary(category, risk_level))
    )
    notes = str(_first(record, "notes", default=build_initial_notes(category, age)))
    clinician = str(_first(record, "clinician", default="Awaiting clinician assignment"))
    status = str(_first(record, "status", default="pending-review"))

    demo = {
        "subjectName": subject_name,
        "respondentName": respondent_name,
        "respondentRelationship": respondent_relationship,
        "age": age,
        "gender": gender,
        "ethnicity": ethnicity,
        "jaundice": jaundice,
        "familyAsd": family_asd,
    }

    return {
        "id": str(record.get("id", "")),
        "category": category,
        "category_label": category_label(category),
        "subject_name": subject_name,
        "respondent_name": respondent_name,
        "respondent_relationship": respondent_relationship,
        "age": age,
        "gender": gender,
        "ethnicity": ethnicity,
        "jaundice": jaundice,
        "family_asd": family_asd,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "aq10_score": aq10_score,
        "status": status,
        "diagnosis": diagnosis,
        "screening_date": screening_date,
        "referral_date": referral_date,
        "created_at": created_at,
        "updated_at": updated_at,
        "clinician": clinician,
        "screening_tool": screening_tool,
        "completed_screenings": completed_screenings,
        "model_used": model_used,
        "is_mock": is_mock,
        "data_source": data_source,
        "tags": tags,
        "notes": notes,
        "interpretation": interpretation,
        "demo": demo,
        "answers": answers,
    }


# ── MongoDB CRUD operations ───────────────────────────────────────────────────

def list_case_records(category: str | None = None) -> list[dict[str, Any]]:
    """Return normalized case records from MongoDB, optionally filtered by category."""
    col = get_cases_collection()
    query: dict[str, Any] = {}
    if category:
        query["category"] = category

    # Sort descending by screening_date then updated_at then id
    raw_docs = list(
        col.find(query).sort(
            [("screening_date", -1), ("updated_at", -1), ("id", -1)]
        )
    )
    records = [normalize_case_record(_strip_mongo_id(doc)) for doc in raw_docs]
    return records


def get_case_record(case_id: str) -> dict[str, Any] | None:
    """Return a single normalized case record from MongoDB."""
    col = get_cases_collection()
    doc = col.find_one({"id": case_id})
    if doc is None:
        return None
    return normalize_case_record(_strip_mongo_id(doc))


def upsert_case_record(record: dict[str, Any]) -> dict[str, Any]:
    """Insert or replace a case record in MongoDB and return the normalized form."""
    normalized = normalize_case_record(record)
    col = get_cases_collection()
    # replace_one with upsert=True: atomic and safe for concurrent requests
    col.replace_one(
        {"id": normalized["id"]},
        normalized,
        upsert=True,
    )
    return normalized


# ── Projection helpers (unchanged logic, unchanged public API) ────────────────

def case_summary(record: dict[str, Any]) -> dict[str, Any]:
    """Build the summary payload used by list and dashboard views."""
    normalized = normalize_case_record(record)
    return {
        "id": normalized["id"],
        "category": normalized["category"],
        "category_label": normalized["category_label"],
        "subject_name": normalized["subject_name"],
        "respondent_name": normalized["respondent_name"],
        "respondent_relationship": normalized["respondent_relationship"],
        "age": normalized["age"],
        "gender": normalized["gender"],
        "risk_level": normalized["risk_level"],
        "risk_score": normalized["risk_score"],
        "screening_date": normalized["screening_date"],
        "status": normalized["status"],
        "diagnosis": normalized["diagnosis"],
        "screening_tool": normalized["screening_tool"],
        "model_used": normalized["model_used"],
        "is_mock": normalized["is_mock"],
        "data_source": normalized["data_source"],
        "tags": normalized["tags"],
    }


def case_detail(record: dict[str, Any]) -> dict[str, Any]:
    """Build the detailed payload used by case and result pages."""
    normalized = normalize_case_record(record)
    detail = case_summary(normalized)
    detail.update(
        {
            "referral_date": normalized["referral_date"],
            "clinician": normalized["clinician"],
            "completed_screenings": normalized["completed_screenings"],
            "aq10_score": normalized["aq10_score"],
            "notes": normalized["notes"],
            "interpretation": normalized["interpretation"],
            "demo": normalized["demo"],
            "answers": normalized["answers"],
        }
    )
    return detail


def dashboard_summary(category: str | None = None) -> dict[str, Any]:
    """Aggregate category-aware dashboard metrics from MongoDB."""
    records = list_case_records(category)
    total_cases = len(records)
    adult_cases = len([r for r in records if r["category"] == "adult"])
    child_cases = len([r for r in records if r["category"] == "child"])
    toddler_cases = len([r for r in records if r["category"] == "toddler"])
    high_risk = len([r for r in records if r["risk_level"] == "High"])
    moderate_risk = len([r for r in records if r["risk_level"] == "Moderate"])
    low_risk = len([r for r in records if r["risk_level"] == "Low"])
    awaiting_review = len(
        [r for r in records if r["status"] in {"pending-review", "in-progress"}]
    )
    mock_cases = len([r for r in records if r["is_mock"]])

    avg_risk = (
        round(sum(r["risk_score"] for r in records) / total_cases, 2)
        if total_cases
        else 0.0
    )
    avg_aq10 = (
        round(sum(r["aq10_score"] for r in records) / total_cases, 1)
        if total_cases
        else 0.0
    )

    return {
        "category_filter": category or "all",
        "totals": {
            "total_cases": total_cases,
            "adult_cases": adult_cases,
            "child_cases": child_cases,
            "toddler_cases": toddler_cases,
            "high_risk": high_risk,
            "moderate_risk": moderate_risk,
            "low_risk": low_risk,
            "awaiting_review": awaiting_review,
            "mock_cases": mock_cases,
            "average_risk_score": avg_risk,
            "average_aq10_score": avg_aq10,
        },
        "recent_cases": [case_summary(r) for r in records[:5]],
        "category_breakdown": [
            {"category": "adult",   "label": "Adult",   "count": adult_cases},
            {"category": "child",   "label": "Child",   "count": child_cases},
            {"category": "toddler", "label": "Toddler", "count": toddler_cases},
        ],
        "modality_confidence": modality_confidence_for_category(category),
    }
