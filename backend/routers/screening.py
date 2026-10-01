"""Screening submission endpoints."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

try:
    from ..core.auth import CurrentUser, get_current_user
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
    from ..ml.gaze import jobs as gaze_jobs
    from ..ml.model import get_bundle, predict
    from ..ml.preprocessing_pipeline import preprocess_screening_input
    from ..schemas.screening import (
        ModalityBreakdown,
        ModalityComponentResult,
        ScreeningRequest,
        ScreeningResponse,
    )
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ..core.auth import CurrentUser, get_current_user
    from ..core.categories import (
        build_case_tags,
        build_diagnosis_summary,
        build_initial_notes,
        build_interpretation,
        category_label,
        default_respondent_relationship,
        screening_tool_for_category,
    )
    from core.cases_store import upsert_case_record
    from ..ml.fusion_engine import fuse, modality_breakdown_as_dicts
    from ml.gaze import jobs as gaze_jobs
    from ml.model import get_bundle, predict
    from ml.preprocessing_pipeline import preprocess_screening_input
    from schemas.screening import (
        ModalityBreakdown,
        ModalityComponentResult,
        ScreeningRequest,
        ScreeningResponse,
    )

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/screen", response_model=ScreeningResponse)
async def run_screening(
    body: ScreeningRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
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

    if result["mock"] and os.environ.get("NEUROSENSE_ALLOW_MOCK_INFERENCE", "").lower() not in ("1", "true"):
        # The questionnaire model is missing: never invent a probability from the AQ-10 sum.
        raise HTTPException(status_code=503, detail="Screening model is unavailable on the server.")

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

    # ── Multimodal preprocessing via unified pipeline ────────────────────────
    # Dispatches to the speech and facial engines (gaze is analysed by /gaze/analyze), and facial_engine without
    # changing any of their internal logic or return shapes.
    _gaze_result = None
    if body.gaze_analysis_id and not body.gaze_skipped:
        _gaze_result = gaze_jobs.result_for(body.gaze_analysis_id, user.user_id)
        if _gaze_result is None:
            raise HTTPException(status_code=422, detail="gazeAnalysisId is unknown, expired or not finished")
    preprocessed = preprocess_screening_input(
        category=category,
        demo=demo_dict,
        answers=answers_dict,
        encoders=bundle.get("encoders"),
        gaze_result=_gaze_result,
        gaze_skipped=body.gaze_skipped or False,
        audio_base64=body.audio_base64,
        audio_mime_type=body.audio_mime_type or "audio/webm",
        transcript_hint=body.transcript_hint or "",
        speech_skipped=body.speech_skipped or False,
        facial_image_base64=body.facial_image_base64,
        facial_skipped=body.facial_skipped or False,
    )
    gaze_result = preprocessed.gaze_result
    speech_result = preprocessed.speech_result
    facial_result = preprocessed.facial_result

    # ── Multimodal fusion via fusion_engine ──────────────────────────────────
    fusion = fuse(
        questionnaire_probability=result["probability"],
        gaze_result=gaze_result,
        speech_result=speech_result,
        facial_result=facial_result,
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
            weight=c.weight,
            contribution=c.contribution,
        )
        for c in fusion.modality_breakdown
    ]
    modality_breakdown_obj = ModalityBreakdown(
        components=breakdown_components,
        modalitiesUsed=fusion.modalities_used,
        heuristicSignal=fusion.heuristic_signal,
        confidenceNote=fusion.confidence_note,
    )

    # Raw gaze/speech/facial sub-results for case storage (may be None)
    gaze_raw = gaze_result or {}
    speech_raw = speech_result or {}
    facial_raw = facial_result or {}

    upsert_case_record(
        {
            "id": case_id,
            "user_id": user.user_id,   # from the verified token, never from the request body
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
            "facial_score": fusion.facial_score,
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
            "gaze_features": {
                **(gaze_raw.get("features") or {}),
                "prediction": gaze_raw.get("prediction"),
                "dataset": gaze_raw.get("dataset"),
                "feature_schema_version": gaze_raw.get("feature_schema_version"),
                "explanation": gaze_raw.get("explanation"),
                "fusion_reason": gaze_raw.get("fusion_reason"),
            } if gaze_raw else {},
            "gaze_status": gaze_raw.get("status", "skipped" if body.gaze_skipped else "not_submitted"),
            "gaze_reason": gaze_raw.get("reason") or body.gaze_skip_reason,
            "gaze_model_version": gaze_raw.get("model_version"),
            "gaze_quality": gaze_raw.get("quality"),
            "gaze_session_id": gaze_raw.get("session_id"),
            "gaze_analyzed_at": gaze_raw.get("analyzed_at"),
            "gaze_preprocessing_version": gaze_raw.get("preprocessing_version"),
            "gaze_error_code": gaze_raw.get("error_code"),
            "gaze_model_status": gaze_raw.get("model_status"),
            "gaze_fusion_eligible": gaze_raw.get("fusion_eligible"),
            "gaze_mock": gaze_raw.get("isMock", True),
            "gaze_method": gaze_raw.get("method") if gaze_raw else None,
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
            "facial_features": facial_raw.get("features", {}),
            "facial_mock": facial_raw.get("isMock", True),
            "facial_method": facial_raw.get("method", "rule_based_heuristic"),
            "facial_is_trained": facial_raw.get("is_trained_model", False),
            "facial_interpretation": facial_raw.get("interpretation", "") or "",
            "facial_skipped": body.facial_skipped or False,
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
        gazeResult=(
            {k: gaze_raw.get(k) for k in (
                "status", "probability", "model_status", "model_version",
                "reason", "quality", "analyzed_at", "preprocessing_version", "error_code",
            )} if gaze_raw else None
        ),
        gazeInterpretation=gaze_raw.get("interpretation") or None,
        speechInterpretation=speech_raw.get("interpretation") or None,
        facialInterpretation=facial_raw.get("interpretation") or None,
        speechFlags=speech_raw.get("clinical_flags") or None,
        submittedAt=now.isoformat(),
    )
