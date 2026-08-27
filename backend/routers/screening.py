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
    from ..ml.fusion_engine import fuse, modality_breakdown_as_dicts
    from ..ml.gaze_engine import compute_gaze_score
    from ..ml.speech_engine import compute_speech_score
    from ..ml.model import get_bundle, predict
    from ..schemas.screening import (
        ModalityBreakdown,
        ModalityComponentResult,
        ScreeningRequest,
        ScreeningResponse,
    )
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
    from ml.fusion_engine import fuse, modality_breakdown_as_dicts
    from ml.gaze_engine import compute_gaze_score
    from ml.speech_engine import compute_speech_score
    from ml.model import get_bundle, predict
    from schemas.screening import (
        ModalityBreakdown,
        ModalityComponentResult,
        ScreeningRequest,
        ScreeningResponse,
    )

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
    screening_tool = screening_tool_for_category(category)
    subject_name = body.demo.subject_name or body.demo.respondent_name or f"{category_label(category)} screening case"
    respondent_name = body.demo.respondent_name or body.demo.subject_name or subject_name
    respondent_relationship = (
        body.demo.respondent_relationship or default_respondent_relationship(category)
    )
    is_mock = result["mock"]

    # ── Gaze analysis ────────────────────────────────────────────────────────
    gaze_result: dict | None = None
    if body.gaze_points and len(body.gaze_points) >= 20:
        gaze_points_raw = [
            {"x": p.x, "y": p.y, "timestamp": p.timestamp, "stimulus": p.stimulus}
            for p in body.gaze_points
        ]
        gaze_result = compute_gaze_score(gaze_points_raw, category=category)
    elif body.gaze_points is not None and not body.gaze_skipped:
        # Attempted but insufficient data
        gaze_result = compute_gaze_score([], category=category)

    # ── Speech analysis ──────────────────────────────────────────────────────
    speech_result: dict | None = None
    if body.audio_base64 and not body.speech_skipped:
        try:
            speech_result = compute_speech_score(
                audio_base64=body.audio_base64,
                mime_type=body.audio_mime_type or "audio/webm",
                transcript_hint=body.transcript_hint or "",
                category=category,
            )
        except Exception as exc:
            speech_result = {
                "score": None,
                "isMock": True,
                "is_trained_model": False,
                "method": "rule_based_heuristic",
                "modality_label": "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                "features": {},
                "interpretation": f"Speech processing error: {str(exc)}",
                "clinical_flags": [],
            }

    # ── Multimodal fusion via fusion_engine ──────────────────────────────────
    # Option A: final_probability = P(Q) exclusively (no trained gaze/speech data).
    # Gaze and speech heuristic scores appear in modality_breakdown as supplemental
    # evidence with is_trained_model=False — they do NOT affect risk_level.
    fusion = fuse(
        questionnaire_probability=result["probability"],
        gaze_result=gaze_result,
        speech_result=speech_result,
        category=category,
    )

    risk_level = fusion.risk_level
    interpretation = build_interpretation(category, risk_level)

    # Build ModalityBreakdown for the response
    breakdown_components = [
        ModalityComponentResult(
            modality=c.modality,
            score=c.score,
            method=c.method,
            isTrainedModel=c.is_trained_model,
            modalityLabel=c.modality_label,
            available=c.available,
        )
        for c in fusion.modality_breakdown
    ]
    modality_breakdown_obj = ModalityBreakdown(
        components=breakdown_components,
        modalitiesUsed=fusion.modalities_used,
        heuristicSignal=fusion.heuristic_signal,
        confidenceNote=fusion.confidence_note,
    )

    # Raw gaze/speech sub-results for case storage (may be None)
    gaze_raw = gaze_result or {}
    speech_raw = speech_result or {}

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
            # Store the questionnaire probability as primary risk_score for XAI
            "risk_score": fusion.questionnaire_probability,
            "fusion_score": fusion.final_probability,
            "questionnaire_probability": fusion.questionnaire_probability,
            "gaze_score": fusion.gaze_score,
            "speech_score": fusion.speech_score,
            "heuristic_signal": fusion.heuristic_signal,
            "confidence_note": fusion.confidence_note,
            "modality_breakdown": modality_breakdown_as_dicts(fusion.modality_breakdown),
            "modalities_used": fusion.modalities_used,
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
            "notes": build_initial_notes(
                category,
                body.demo.age * 12 if category == "toddler" else body.demo.age,
            ),
            "interpretation": interpretation,
            "demo": demo_dict,
            "answers": answers_dict,
            "gaze_features": gaze_raw.get("features", {}),
            "gaze_mock": gaze_raw.get("isMock", True),
            "gaze_method": gaze_raw.get("method", "rule_based_heuristic"),
            "gaze_is_trained": gaze_raw.get("is_trained_model", False),
            "gaze_interpretation": gaze_raw.get("interpretation", "") or "",
            "gaze_skipped": body.gaze_skipped or False,
            "speech_features": speech_raw.get("features", {}),
            "speech_mock": speech_raw.get("isMock", True),
            "speech_method": speech_raw.get("method", "rule_based_heuristic"),
            "speech_is_trained": speech_raw.get("is_trained_model", False),
            "speech_interpretation": speech_raw.get("interpretation", "") or "",
            "speech_flags": speech_raw.get("clinical_flags", []),
            "speech_skipped": body.speech_skipped or False,
        }
    )

    return ScreeningResponse(
        caseId=case_id,
        category=category,
        categoryLabel=category_label(category),
        status="pending-review",
        riskLevel=risk_level,
        fusionScore=fusion.final_probability,
        questionnaireProbability=fusion.questionnaire_probability,
        heuristicSignal=fusion.heuristic_signal,
        confidenceNote=fusion.confidence_note,
        modalityBreakdown=modality_breakdown_obj,
        aq10Score=body.aq10_score,
        modelUsed=result["model_used"],
        isMock=is_mock,
        dataSource="mock" if is_mock else "model",
        interpretation=interpretation,
        gazeInterpretation=gaze_raw.get("interpretation") or None,
        speechInterpretation=speech_raw.get("interpretation") or None,
        speechFlags=speech_raw.get("clinical_flags") or None,
        submittedAt=now.isoformat(),
    )
