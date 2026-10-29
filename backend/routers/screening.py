"""Screening submission endpoint.

Everything that determines the result is computed HERE, from the validated answers: the client's total,
risk level, probabilities and any metadata about scoring are ignored.  The result comes from the central
contract in ml/fusion_engine.py; experimental / unavailable modalities are reported but never enter it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

try:
    from ..core.auth import CurrentUser, get_current_user
    from ..core.categories import (build_case_tags, build_diagnosis_summary, build_initial_notes, build_interpretation,
                                   category_label, default_respondent_relationship, screening_tool_for_category)
    from ..core.cases_store import upsert_case_record
    from ..ml.fusion_engine import combine
    from ..ml.gaze import jobs as gaze_jobs
    from ..ml.model import get_bundle, predict
    from ..ml.modality_status import facial_state, gaze_state, questionnaire_state, speech_state
    from ..ml.preprocessing_pipeline import preprocess_screening_input
    from ..ml import toddler_service
    from ..ml.questionnaire_score import AnswerError, score_questionnaire
    from ..schemas.screening import ScreeningRequest, ScreeningResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.auth import CurrentUser, get_current_user
    from core.categories import (build_case_tags, build_diagnosis_summary, build_initial_notes, build_interpretation,
                                 category_label, default_respondent_relationship, screening_tool_for_category)
    from core.cases_store import upsert_case_record
    from ml.fusion_engine import combine
    from ml.gaze import jobs as gaze_jobs
    from ml.model import get_bundle, predict
    from ml.modality_status import facial_state, gaze_state, questionnaire_state, speech_state
    from ml.preprocessing_pipeline import preprocess_screening_input
    from ml import toddler_service
    from ml.questionnaire_score import AnswerError, score_questionnaire
    from schemas.screening import ScreeningRequest, ScreeningResponse

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/screen", response_model=ScreeningResponse)
async def run_screening(
    body: ScreeningRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Score a completed questionnaire on the server and persist the case for the authenticated user."""
    category = body.category.value
    demo_dict = body.demo.model_dump(by_alias=True, exclude_none=True, mode="json")
    answers_dict = dict(body.answers)                           # validated + canonicalised by the schema
    warnings: list[str] = []

    # 1. Authoritative score (the only input to the result)
    toddler = None
    try:
        if category == "toddler":
            from ..ml import qchat10 as _q
            toddler = toddler_service.analyze(answers_dict, body.demo.age_months, {"Female": True, "Male": False}.get(body.demo.gender.value))
            screening = toddler["screening"]
        else:
            screening = score_questionnaire(category, answers_dict)
    except (AnswerError, ValueError) as exc:                     # unreachable via the schema; defence in depth
        raise HTTPException(status_code=422, detail=f"Invalid questionnaire answers: {exc}") from exc
    if body.aq10_score is not None and body.aq10_score != screening["total_score"]:
        warnings.append(f"The client-reported total ({body.aq10_score}) differs from the server-computed total "
                        f"({screening['total_score']}); the server value is used.")

    # 2. ML model output - transparency only; failure never blocks the screening
    model_output = None
    if category == "toddler":
        mo = toddler["model"]
        model_output = mo if mo.get("available") else None
        if model_output is None:
            warnings.append(f"{mo['reason']}; the official Q-CHAT-10 result is unaffected.")
    else:
        try:
            model_output = predict(category, get_bundle(request.app.state.model_registry or {}, category), demo_dict, answers_dict)
        except Exception:
            warnings.append("The questionnaire ML model output could not be computed; the score-based result is unaffected.")
        if model_output is None and "could not be computed" not in " ".join(warnings):
            warnings.append("No questionnaire ML model is loaded; the score-based result is unaffected.")

    # 3. Other modalities (gaze job looked up by id, owner-checked; speech/facial measured)
    gaze_result = None
    if body.gaze_analysis_id and not body.gaze_skipped:
        gaze_result = gaze_jobs.result_for(body.gaze_analysis_id, user.user_id)
        if gaze_result is None:
            raise HTTPException(status_code=422, detail="gazeAnalysisId is unknown, expired or not finished")
    pre = preprocess_screening_input(
        category, gaze_result=gaze_result, gaze_skipped=body.gaze_skipped or False,
        audio_base64=body.audio_base64, audio_mime_type=body.audio_mime_type or "audio/webm",
        speech_skipped=body.speech_skipped or False, facial_image_base64=body.facial_image_base64,
        facial_skipped=body.facial_skipped or False)
    states = [
        questionnaire_state(screening, model_output),
        gaze_state(pre.gaze_result, body.gaze_skipped or False, body.gaze_skip_reason),
        speech_state(pre.speech_result, body.speech_skipped or False),
        facial_state(pre.facial_result, body.facial_skipped or False),
    ]

    # 4. Central result contract
    result = combine(screening, states)
    risk_level = result["risk_level"]
    interpretation = build_interpretation(category, risk_level)

    now = datetime.now(timezone.utc)
    case_id = f"NS-{category[0].upper()}-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    screening_tool = screening_tool_for_category(category)
    subject_name = body.demo.subject_name or body.demo.respondent_name or f"{category_label(category)} screening case"
    respondent_name = body.demo.respondent_name or body.demo.subject_name or subject_name
    respondent_relationship = body.demo.respondent_relationship or default_respondent_relationship(category)
    gaze_raw = pre.gaze_result or {}
    speech_raw = pre.speech_result or {}
    facial_raw = pre.facial_result or {}
    model_used = model_output["model_used"] if model_output else "score_rule"

    upsert_case_record({
        "id": case_id,
        "user_id": user.user_id,                     # from the verified session, never from the request body
        "category": category, "subject_name": subject_name, "respondent_name": respondent_name,
        "respondent_relationship": respondent_relationship, "age": body.demo.age, "gender": body.demo.gender.value,
        "ethnicity": body.demo.ethnicity,
        "jaundice": body.demo.jaundice.value if body.demo.jaundice else None,
        "family_asd": body.demo.family_asd.value if body.demo.family_asd else None,
        "risk_level": risk_level, "risk_score": None, "fusion_score": None,
        "questionnaire_probability": model_output["probability"] if model_output else None,
        "scoring_version": screening["scoring_version"], "questionnaire_basis": screening, "questionnaire_model": model_output,
        "age_months": body.demo.age_months,
        "screening_result": result, "modality_states": states, "warnings": warnings,
        "modality_breakdown": [], "modalities_used": 1,
        "confidence_note": result["note"],
        "aq10_score": screening["total_score"],
        "status": "pending-review", "diagnosis": build_diagnosis_summary(category, risk_level),
        "screening_date": now.date().isoformat(), "referral_date": now.date().isoformat(),
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "clinician": "Awaiting clinician assignment", "screening_tool": screening_tool,
        "completed_screenings": [screening_tool], "model_used": model_used,
        "is_mock": False, "data_source": "score_rule+model" if model_output else "score_rule",
        "tags": build_case_tags(category, risk_level, False, score_rule=True),
        "notes": build_initial_notes(category, body.demo.age), "interpretation": interpretation,
        "demo": demo_dict, "answers": answers_dict,
        # experimental gaze measurements (legacy field names kept for the existing results view)
        "gaze_features": ({**(gaze_raw.get("features") or {}), "prediction": gaze_raw.get("prediction"),
                           "dataset": gaze_raw.get("dataset"), "feature_schema_version": gaze_raw.get("feature_schema_version"),
                           "explanation": gaze_raw.get("explanation"), "fusion_reason": "experimental: excluded from the result",
                           "descriptive": gaze_raw.get("descriptive"), "domain": gaze_raw.get("domain")} if gaze_raw else {}),
        "gaze_status": gaze_raw.get("status", "skipped" if body.gaze_skipped else "not_submitted"),
        "gaze_reason": gaze_raw.get("reason") or body.gaze_skip_reason,
        "gaze_score": gaze_raw.get("probability"), "gaze_model_version": gaze_raw.get("model_version"),
        "gaze_quality": gaze_raw.get("quality"), "gaze_session_id": gaze_raw.get("session_id"),
        "gaze_analyzed_at": gaze_raw.get("analyzed_at"), "gaze_preprocessing_version": gaze_raw.get("preprocessing_version"),
        "gaze_error_code": gaze_raw.get("error_code"), "gaze_model_status": gaze_raw.get("model_status"),
        "gaze_fusion_eligible": False, "gaze_mock": False, "gaze_method": gaze_raw.get("method") if gaze_raw else None,
        "gaze_is_trained": False, "gaze_interpretation": gaze_raw.get("interpretation", "") or "",
        "gaze_skipped": body.gaze_skipped or False,
        "speech_features": speech_raw.get("features", {}), "speech_skipped": body.speech_skipped or False,
        "speech_interpretation": speech_raw.get("interpretation", "") or "",
        "facial_features": facial_raw.get("features", {}), "facial_skipped": body.facial_skipped or False,
        "facial_interpretation": facial_raw.get("interpretation", "") or "",
    })

    return ScreeningResponse(
        caseId=case_id, category=category, categoryLabel=category_label(category), status="pending-review",
        riskLevel=risk_level, questionnaireProbability=model_output["probability"] if model_output else None,
        questionnaireBasis=screening, modelOutput=model_output, result=result, modalities=states, warnings=warnings,
        confidenceNote=result["note"], aq10Score=screening["total_score"], modelUsed=model_used, isMock=False,
        dataSource="score_rule+model" if model_output else "score_rule", interpretation=interpretation,
        gazeResult=({k: gaze_raw.get(k) for k in ("status", "probability", "model_status", "model_version", "reason", "quality",
                                                  "analyzed_at", "preprocessing_version", "error_code")} if gaze_raw else None),
        gazeInterpretation=gaze_raw.get("interpretation") or None,
        speechInterpretation=speech_raw.get("interpretation") or None,
        facialInterpretation=facial_raw.get("interpretation") or None, speechFlags=None,
        submittedAt=now.isoformat())
