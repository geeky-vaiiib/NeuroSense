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
    from ..ml.gaze_engine import compute_gaze_score
    from ..ml.speech_engine import compute_speech_score
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
    from ml.gaze_engine import compute_gaze_score
    from ml.speech_engine import compute_speech_score
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

    # ── Gaze analysis ───────────────────────────────────────────────
    gaze_result: dict = {"score": None, "isMock": True, "features": {}, "interpretation": ""}
    if body.gaze_points and len(body.gaze_points) >= 20:
        gaze_points_raw = [
            {"x": p.x, "y": p.y, "timestamp": p.timestamp, "stimulus": p.stimulus}
            for p in body.gaze_points
        ]
        gaze_result = compute_gaze_score(gaze_points_raw, category=category)

    gaze_interpretation = gaze_result.get("interpretation", "") or None

    # ── Speech analysis ─────────────────────────────────────────────
    speech_result: dict = {
        "score": None, "isMock": True, "features": {},
        "interpretation": "", "clinical_flags": [],
    }
    if body.audio_base64 and not body.speech_skipped:
        try:
            speech_result = compute_speech_score(
                audio_base64=body.audio_base64,
                mime_type=body.audio_mime_type or "audio/webm",
                transcript_hint=body.transcript_hint or "",
                category=category,
            )
        except Exception as exc:
            speech_result["interpretation"] = f"Speech processing error: {str(exc)}"

    speech_score = speech_result.get("score")
    speech_interpretation = speech_result.get("interpretation", "") or None

    # ── Multimodal fusion ───────────────────────────────────────────
    #   Weights: quest 0.40, facial 0.25 (N/A), gaze 0.20, speech 0.15
    #   Redistribute unavailable modality weights to available ones.
    questionnaire_prob = result["probability"]
    gaze_score = gaze_result.get("score")

    available: list[tuple[float, float]] = []  # (weight, score)
    available.append((0.40, questionnaire_prob))
    if gaze_score is not None:
        available.append((0.20, gaze_score))
    if speech_score is not None:
        available.append((0.15, speech_score))

    total_weight = sum(w for w, _ in available)
    if total_weight > 0:
        fusion_score = round(
            sum(w * s for w, s in available) / total_weight, 4
        )
    else:
        fusion_score = questionnaire_prob

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
            "notes": build_initial_notes(category, body.demo.age * 12 if category == "toddler" else body.demo.age),
            "interpretation": interpretation,
            "demo": demo_dict,
            "answers": answers_dict,
            "gaze_features": gaze_result.get("features", {}),
            "gaze_mock": gaze_result.get("isMock", True),
            "gaze_interpretation": gaze_interpretation or "",
            "gaze_skipped": body.gaze_skipped or False,
            "speech_features": speech_result.get("features", {}),
            "speech_mock": speech_result.get("isMock", True),
            "speech_interpretation": speech_interpretation or "",
            "speech_flags": speech_result.get("clinical_flags", []),
            "speech_skipped": body.speech_skipped or False,
        }
    )

    return ScreeningResponse(
        caseId=case_id,
        category=category,
        categoryLabel=category_label(category),
        status="pending-review",
        riskLevel=risk_level,
        fusionScore=fusion_score,
        aq10Score=body.aq10_score,
        modelUsed=result["model_used"],
        isMock=is_mock,
        dataSource="mock" if is_mock else "model",
        interpretation=interpretation,
        gazeInterpretation=gaze_interpretation,
        speechInterpretation=speech_interpretation,
        speechFlags=speech_result.get("clinical_flags", []) or None,
        submittedAt=now.isoformat(),
    )
