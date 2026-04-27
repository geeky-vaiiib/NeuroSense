"""Screening submission endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

try:
    from ..core.categories import (
        build_case_tags,
        build_diagnosis_summary,
        build_initial_notes,
        build_interpretation,
        category_label,
        default_respondent_relationship,
        screening_tool_for_category,
    )
    from ..core.cases_store import upsert_case_record
    from ..ml.model import get_bundle, predict
    from ..schemas.screening import ScreeningRequest, ScreeningResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.categories import (
        build_case_tags,
        build_diagnosis_summary,
        build_initial_notes,
        build_interpretation,
        category_label,
        default_respondent_relationship,
        screening_tool_for_category,
    )
    from core.cases_store import upsert_case_record
    from ml.model import get_bundle, predict
    from schemas.screening import ScreeningRequest, ScreeningResponse

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/screen", response_model=ScreeningResponse)
async def run_screening(body: ScreeningRequest, request: Request):
    """Submit a completed screening and persist a category-aware case record."""
    registry = request.app.state.model_registry or {}
    category = body.category.value
    bundle = get_bundle(registry, category)
    demo_dict = body.demo.model_dump(by_alias=True, exclude_none=True, mode="json")
    answers_dict = body.answers.model_dump(mode="json")

    try:
        result = predict(category, bundle, demo_dict, answers_dict)
    except Exception as exc:  # pragma: no cover - defensive error surface
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    now = datetime.now(timezone.utc)
    case_id = (
        f"NS-{category[0].upper()}-{now.strftime('%Y%m%d')}-"
        f"{uuid.uuid4().hex[:4].upper()}"
    )
    risk_level = result["risk_level"]
    screening_tool = screening_tool_for_category(category)
    subject_name = body.demo.subject_name or body.demo.respondent_name or f"{category_label(category)} screening case"
    respondent_name = body.demo.respondent_name or body.demo.subject_name or subject_name
    respondent_relationship = (
        body.demo.respondent_relationship or default_respondent_relationship(category)
    )
    is_mock = result["mock"]
    interpretation = build_interpretation(category, risk_level)

    upsert_case_record(
        {
            "id": case_id,
            "category": category,
            "subject_name": subject_name,
            "respondent_name": respondent_name,
            "respondent_relationship": respondent_relationship,
            "age": body.demo.age,
            "gender": body.demo.gender.value,
            "ethnicity": body.demo.ethnicity,
            "jaundice": body.demo.jaundice.value if body.demo.jaundice else None,
            "family_asd": body.demo.family_asd.value if body.demo.family_asd else None,
            "risk_level": risk_level,
            "risk_score": result["probability"],
            "aq10_score": body.aq10_score,
            "status": "pending-review",
            "diagnosis": build_diagnosis_summary(category, risk_level),
            "screening_date": now.date().isoformat(),
            "referral_date": now.date().isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "clinician": "Awaiting clinician assignment",
            "screening_tool": screening_tool,
            "completed_screenings": [screening_tool],
            "model_used": result["model_used"],
            "is_mock": is_mock,
            "data_source": "mock" if is_mock else "model",
            "tags": build_case_tags(category, risk_level, is_mock),
            "notes": build_initial_notes(category, body.demo.age),
            "interpretation": interpretation,
            "demo": demo_dict,
            "answers": answers_dict,
        }
    )

    return ScreeningResponse(
        caseId=case_id,
        category=category,
        categoryLabel=category_label(category),
        status="pending-review",
        riskLevel=risk_level,
        fusionScore=result["probability"],
        aq10Score=body.aq10_score,
        modelUsed=result["model_used"],
        isMock=is_mock,
        dataSource="mock" if is_mock else "model",
        interpretation=interpretation,
        submittedAt=now.isoformat(),
    )
