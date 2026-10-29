"""Explainability endpoints.

Two different things are explained, and the response keeps them apart:
  * ``scoreExplanation`` - how the questionnaire TOTAL (which determines the result) was formed, item by item.
  * ``modelExplanation`` - SHAP / LIME for the questionnaire ML model's output.  That model was trained on labels
    that are a threshold on the same total, so these attributions describe a model of the scoring rule; they do not
    explain the result, a diagnosis, or any gaze / speech / facial measurement.
Explanations are computed on demand (not stored) from the stored answers with the same preprocessing as inference.
If the model or the explainer is unavailable the endpoint says so - it never returns placeholder values.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request

try:
    from ..core.auth import CurrentUser, get_current_user
    from ..core.categories import build_interpretation, category_label, feature_label
    from ..core.cases_store import get_case_record
    from ..ml.lime_engine import compute_lime
    from ..ml.model import get_bundle
    from ..ml.preprocessor import feature_names_for, preprocess_for_inference
    from ..ml import toddler_service
    from ..ml.questionnaire_score import AnswerError, score_questionnaire
    from ..ml.shap_engine import compute_shap
    from ..schemas.screening import CombinedExplainResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.auth import CurrentUser, get_current_user
    from core.categories import build_interpretation, category_label, feature_label
    from core.cases_store import get_case_record
    from ml.lime_engine import compute_lime
    from ml.model import get_bundle
    from ml.preprocessor import feature_names_for, preprocess_for_inference
    from ml import toddler_service
    from ml.questionnaire_score import AnswerError, score_questionnaire
    from ml.shap_engine import compute_shap
    from schemas.screening import CombinedExplainResponse

router = APIRouter(prefix="/explain", tags=["Explainability"])

MODEL_SCOPE = ("Local explanation of the questionnaire ML model's output for this one submission. The model reproduces "
               "the scoring rule (its training labels are a threshold on the total), so this describes the model, "
               "not the result, not a diagnosis, and not any gaze, speech or facial measurement.")


def _score_explanation(case_data: dict, category: str, answers: dict) -> tuple[dict | None, str | None]:
    """Per-item points. Server-scored cases use the stored block; older cases are re-scored with CURRENT rules."""
    stored = case_data.get("questionnaire_basis")
    if case_data.get("scoring_version") and stored:
        return stored, None
    try:
        return score_questionnaire(category, answers), "Recomputed from the stored answers with the current scoring rules (this case predates server-side scoring)."
    except AnswerError as exc:
        return None, f"The stored answers cannot be scored: {exc}"


@router.get("/{case_id}", response_model=CombinedExplainResponse)
async def explain_case(case_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    """Score explanation + (when a model is loaded) SHAP and LIME for the model output."""
    registry = request.app.state.model_registry or {}
    case_data = get_case_record(case_id, user.user_id)         # ownership is checked before any model work
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")

    category = case_data["category"]
    demo, answers = case_data.get("demo", {}), case_data.get("answers", {})
    if category == "toddler":
        return _explain_toddler(case_id, case_data, demo, answers)
    bundle = get_bundle(registry, category)
    clf = bundle.get("model")
    score_exp, score_note = _score_explanation(case_data, category, answers)
    interpretation = build_interpretation(category, case_data.get("risk_level", "Low"))
    base = dict(caseId=case_id, category=category, categoryLabel=category_label(category),
                modelUsed=case_data.get("model_used") or "", isMock=False,
                dataSource=case_data.get("data_source", "score_rule"),
                scoringVersion=case_data.get("scoring_version"), scoreExplanation=score_exp,
                generatedAt=datetime.now(timezone.utc).isoformat())

    def unavailable(reason: str):
        return CombinedExplainResponse(**base, shap=[], lime=[], summary=interpretation, modelExplanation={
            "available": False, "reason": reason, "scope": MODEL_SCOPE})

    if clf is None:
        return unavailable("No questionnaire ML model is loaded on the server.")
    try:
        X = preprocess_for_inference(demo, answers, bundle.get("encoders"), category=category)
    except (AnswerError, ValueError) as exc:
        return unavailable(f"The stored submission cannot be re-encoded for the model: {exc}")

    names = feature_names_for(category)
    if X.shape[1] != len(names):
        raise HTTPException(status_code=500, detail="feature contract mismatch between preprocessing and explanation")
    background = bundle.get("background")
    if not isinstance(background, np.ndarray) or background.ndim != 2 or background.shape[1] != X.shape[1]:
        background = None

    shap_raw = compute_shap(model=clf, X_instance=X, feature_names=names, background=background)
    lime_raw = compute_lime(model=clf, X_instance=X, X_train=background, feature_names=names)
    if shap_raw is None and lime_raw is None:
        return unavailable("SHAP and LIME could not be computed for this model.")

    shap_out = [{"feature": feature_label(i["feature"], category), "shapValue": i["shap_value"], "direction": i["direction"]}
                for i in (shap_raw or [])]
    lime_out = [{"feature": feature_label(i["feature"], category), "weight": i["weight"], "direction": i["direction"],
                 "plainEnglish": i["plain_english"]} for i in (lime_raw or [])]
    summary = interpretation
    if shap_out:
        summary += " Model-explanation top features: " + ", ".join(i["feature"] for i in shap_out[:2]) + "."
    return CombinedExplainResponse(**base, shap=shap_out, lime=lime_out, summary=summary, modelExplanation={
        "available": True, "scope": MODEL_SCOPE, "methods": {"shap": bool(shap_raw), "lime": bool(lime_raw)},
        "explains": "questionnaire ML model output (probability of the scoring-rule label)", "feature_values": "item features are 0/1 points, not raw answers",
        "note": score_note})


TODDLER_SCOPE = ("Local SHAP explanation of the toddler questionnaire model's output for this one submission. Contributions are "
                 "associations learned from one Polish cohort (ASD group vs controls), not causes, not a diagnosis, and unrelated to "
                 "any gaze, speech or facial measurement. The official Q-CHAT-10 score (section 1) is what the result is based on.")


def _explain_toddler(case_id: str, case_data: dict, demo: dict, answers: dict) -> CombinedExplainResponse:
    interpretation = build_interpretation("toddler", case_data.get("risk_level", "Low"))
    base = dict(caseId=case_id, category="toddler", categoryLabel=category_label("toddler"), modelUsed=case_data.get("model_used") or "",
                isMock=False, dataSource=case_data.get("data_source", "score_rule"), scoringVersion=case_data.get("scoring_version"),
                scoreExplanation=case_data.get("questionnaire_basis") if case_data.get("scoring_version") else None,
                generatedAt=datetime.now(timezone.utc).isoformat())

    def unavailable(reason: str):
        return CombinedExplainResponse(**base, shap=[], lime=[], summary=interpretation,
                                       modelExplanation={"available": False, "reason": reason, "scope": TODDLER_SCOPE})

    if not case_data.get("scoring_version"):
        return unavailable("This toddler case was recorded with a superseded questionnaire and model; no explanation can be computed.")
    ex = toddler_service.explain(answers, case_data.get("age_months"), {"Female": True, "Male": False}.get(demo.get("gender")))
    if ex is None:
        return unavailable("The toddler questionnaire model is not available on the server.")
    shap_out = [{"feature": i["label"], "shapValue": i["contribution"], "direction": "positive" if i["contribution"] > 0 else "negative"} for i in ex["items"]]
    return CombinedExplainResponse(**base, shap=shap_out, lime=[], summary=interpretation, modelExplanation={
        "available": True, "scope": TODDLER_SCOPE, "methods": {"shap": True, "lime": False}, "model_version": ex["model_version"],
        "explains": "toddler questionnaire model output (calibrated similarity to the cohort's ASD-group responses)",
        "shap_method": ex["method"], "shap_units": "log-odds", "note": ex["note"] + " LIME is not provided for this model."})
