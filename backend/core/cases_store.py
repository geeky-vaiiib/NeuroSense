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

    # ── Fusion metadata (new fields — gracefully absent on old records) ────────
    questionnaire_probability = float(
        _first(record, "questionnaire_probability", default=risk_score) or risk_score
    )
    fusion_score = float(
        _first(record, "fusion_score", default=questionnaire_probability) or questionnaire_probability
    )
    gaze_score = _first(record, "gaze_score", default=None)
    speech_score = _first(record, "speech_score", default=None)
    heuristic_signal = _first(record, "heuristic_signal", default=None)
    confidence_note = str(_first(record, "confidence_note", default="") or "")
    modality_breakdown = list(_first(record, "modality_breakdown", default=[]) or [])
    modalities_used = int(_first(record, "modalities_used", default=1) or 1)

    # ── Gaze / speech engine metadata ─────────────────────────────────────────
    gaze_features = dict(_first(record, "gaze_features", default={}) or {})
    gaze_mock = bool(_first(record, "gaze_mock", default=True))
    gaze_method = str(_first(record, "gaze_method", default="rule_based_heuristic"))
    gaze_is_trained = bool(_first(record, "gaze_is_trained", default=False))
    gaze_interpretation = str(_first(record, "gaze_interpretation", default="") or "")
    gaze_skipped = bool(_first(record, "gaze_skipped", default=False))
    # Optional gaze-analysis metadata; absent on cases created before the browser gaze model.
    gaze_status = _first(record, "gaze_status", default=None)
    gaze_reason = _first(record, "gaze_reason", default=None)
    gaze_model_version = _first(record, "gaze_model_version", default=None)
    gaze_quality = _first(record, "gaze_quality", default=None)
    gaze_session_id = _first(record, "gaze_session_id", default=None)
    gaze_analyzed_at = _first(record, "gaze_analyzed_at", default=None)
    gaze_preprocessing_version = _first(record, "gaze_preprocessing_version", default=None)
    gaze_error_code = _first(record, "gaze_error_code", default=None)
    gaze_model_status = _first(record, "gaze_model_status", default=None)
    gaze_fusion_eligible = record.get("gaze_fusion_eligible")

    speech_features = dict(_first(record, "speech_features", default={}) or {})
    speech_mock = bool(_first(record, "speech_mock", default=True))
    speech_method = str(_first(record, "speech_method", default="rule_based_heuristic"))
    speech_is_trained = bool(_first(record, "speech_is_trained", default=False))
    speech_interpretation = str(_first(record, "speech_interpretation", default="") or "")
    speech_flags = list(_first(record, "speech_flags", default=[]) or [])
    speech_skipped = bool(_first(record, "speech_skipped", default=False))

    return {
        "id": str(record.get("id", "")),
        # Owner (set only by the backend from the authenticated user). Legacy cases: None.
        "user_id": record.get("user_id"),
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
        "questionnaire_probability": questionnaire_probability,
        "fusion_score": fusion_score,
        "gaze_score": gaze_score,
        "speech_score": speech_score,
        "heuristic_signal": heuristic_signal,
        "confidence_note": confidence_note,
        "modality_breakdown": modality_breakdown,
        "modalities_used": modalities_used,
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
        "gaze_features": gaze_features,
        "gaze_mock": gaze_mock,
        "gaze_method": gaze_method,
        "gaze_is_trained": gaze_is_trained,
        "gaze_interpretation": gaze_interpretation,
        "gaze_skipped": gaze_skipped,
        "gaze_status": gaze_status,
        "gaze_reason": gaze_reason,
        "gaze_model_version": gaze_model_version,
        "gaze_quality": gaze_quality,
        "gaze_session_id": gaze_session_id,
        "gaze_analyzed_at": gaze_analyzed_at,
        "gaze_preprocessing_version": gaze_preprocessing_version,
        "gaze_error_code": gaze_error_code,
        "gaze_model_status": gaze_model_status,
        "gaze_fusion_eligible": gaze_fusion_eligible,
        "speech_features": speech_features,
        "speech_mock": speech_mock,
        "speech_method": speech_method,
        "speech_is_trained": speech_is_trained,
        "speech_interpretation": speech_interpretation,
        "speech_flags": speech_flags,
        "speech_skipped": speech_skipped,
    }


# ── MongoDB CRUD operations ───────────────────────────────────────────────────

def _require_owner(user_id: str) -> str:
    """Ownership is mandatory: an empty/None user_id must never turn into an unscoped query."""
    if not user_id or not isinstance(user_id, str):
        raise ValueError("user_id is required for case access")
    return user_id


def list_case_records(user_id: str, category: str | None = None) -> list[dict[str, Any]]:
    """Return the caller's normalized case records (filtered in the database query)."""
    col = get_cases_collection()
    query: dict[str, Any] = {"user_id": _require_owner(user_id)}
    if category:
        query["category"] = category

    # Sort descending by screening_date then updated_at then id
    raw_docs = list(
        col.find(query).sort(
            [("screening_date", -1), ("updated_at", -1), ("id", -1)]
        )
    )
    return [normalize_case_record(_strip_mongo_id(doc)) for doc in raw_docs]


def get_case_record(case_id: str, user_id: str) -> dict[str, Any] | None:
    """Return one case only if it belongs to ``user_id`` (else None — same as not found)."""
    col = get_cases_collection()
    doc = col.find_one({"id": case_id, "user_id": _require_owner(user_id)})
    if doc is None:
        return None
    return normalize_case_record(_strip_mongo_id(doc))


def upsert_case_record(record: dict[str, Any]) -> dict[str, Any]:
    """Insert or replace a case. The record must carry the owner's user_id.

    The upsert filter includes user_id, so an id collision with another user's case can never
    overwrite it (the unique index on ``id`` makes it fail instead).
    """
    _require_owner(record.get("user_id"))
    normalized = normalize_case_record(record)
    col = get_cases_collection()
    col.replace_one(
        {"id": normalized["id"], "user_id": normalized["user_id"]},
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


def _gaze_object(n: dict[str, Any]) -> dict[str, Any] | None:
    """{available, probability, model_status, ...} built only from stored backend output."""
    status = n.get("gaze_status")
    if not status:
        return None
    ok = status == "success"
    return {
        "available": ok,
        "status": status,
        "probability": n.get("gaze_score") if ok else None,   # unavailable is never 0.0
        "model_status": n.get("gaze_model_status"),
        "model_version": n.get("gaze_model_version"),
        "preprocessing_version": n.get("gaze_preprocessing_version"),
        "error_code": n.get("gaze_error_code"),
        "fusion_eligible": n.get("gaze_fusion_eligible"),
        "reason": n.get("gaze_reason"),
        "quality": n.get("gaze_quality"),
        "analyzed_at": n.get("gaze_analyzed_at"),
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
            "modality_breakdown": normalized["modality_breakdown"],
            "modalities_used": normalized["modalities_used"],
            "confidence_note": normalized["confidence_note"],
            "fusion_score": normalized["fusion_score"],
            "questionnaire_probability": normalized["questionnaire_probability"],
            # Gaze analysis fields (None on cases created before the gaze model)
            **{k: normalized.get(k) for k in (
                "gaze_score", "gaze_status", "gaze_reason", "gaze_model_version",
                "gaze_quality", "gaze_features", "gaze_interpretation",
                "gaze_analyzed_at", "gaze_skipped", "gaze_mock",
                "gaze_preprocessing_version", "gaze_error_code", "gaze_fusion_eligible",
            )},
            # Consolidated, backend-produced gaze result (None for cases without gaze)
            "gaze": _gaze_object(normalized),
        }
    )
    return detail


_MODALITIES = (
    ("questionnaire", "Questionnaire"), ("gaze", "Gaze"), ("speech", "Speech"),
)


def _modality_status(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Real per-modality counts from stored breakdowns: how many sessions produced a usable
    signal, and how many of those actually influenced the fused result."""
    out = []
    for mid, label in _MODALITIES:
        available = used = 0
        for r in records:
            comp = next((c for c in (r.get("modality_breakdown") or []) if c.get("modality") == mid), None)
            if mid == "questionnaire":
                available += 1
                used += 1
            elif comp and comp.get("available"):
                available += 1
                used += 1 if comp.get("isTrainedModel") else 0
        out.append({"id": mid, "label": label, "available": available, "used_in_fusion": used, "total": len(records)})
    return out


def dashboard_summary(user_id: str, category: str | None = None) -> dict[str, Any]:
    """Aggregate dashboard metrics over the caller's own cases only."""
    records = list_case_records(user_id, category)
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
        "modality_status": _modality_status(records),
    }
