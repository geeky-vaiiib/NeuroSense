"""
routers/explainability.py — GET /explain/{caseId} endpoint.

Loads stored case data from cases_db.json, runs both SHAP and LIME engines,
and returns a combined JSON response with a plain-language summary.
"""

import os
import json
from fastapi import APIRouter, Request, HTTPException
from schemas.screening import CombinedExplainResponse
from ml.shap_engine import compute_shap, FEATURE_NAMES
from ml.lime_engine import compute_lime
from ml.preprocessor import preprocess_for_inference

router = APIRouter(prefix="/explain", tags=["Explainability"])

# ── Cases DB path ──────────────────────────────────────────────────
CASES_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cases_db.json")


def _load_cases_db() -> dict:
    """Load the cases JSON file database."""
    if not os.path.exists(CASES_DB_PATH):
        return {}
    with open(CASES_DB_PATH, "r") as f:
        return json.load(f)


def _build_summary(risk_level: str, shap_results: list, lime_results: list) -> str:
    """
    Build a single plain-language sentence summarising the explanation.
    Uses the top SHAP contributor and risk level.
    """
    if not shap_results:
        return f"This case was assessed as {risk_level} risk based on the screening data."

    top_shap = shap_results[0]
    top_feature = top_shap["feature"]
    direction = top_shap["direction"]

    # Try to get a plain-english description from LIME if available
    plain_desc = None
    for lf in lime_results:
        if lf["feature"] == top_feature:
            plain_desc = lf["plain_english"]
            break

    if plain_desc:
        return (
            f"This case was assessed as {risk_level} risk; "
            f"the strongest contributing factor was: {plain_desc.lower()}."
        )

    dir_word = "increased" if direction == "positive" else "decreased"
    return (
        f"This case was assessed as {risk_level} risk; "
        f"the feature '{top_feature}' {dir_word} the predicted risk the most."
    )


@router.get("/{case_id}", response_model=CombinedExplainResponse)
async def explain_case(case_id: str, request: Request):
    """
    Compute SHAP + LIME explanations for a screened case.

    Returns:
      - shap: top 8 features with SHAP values
      - lime: top 5 features with weights + plain-English descriptions
      - summary: one-sentence plain-language explanation
    """
    model_bundle = request.app.state.model_bundle
    clf = model_bundle.get("model") if model_bundle else None
    encoders = model_bundle.get("encoders") if model_bundle else None

    # ── Load case from JSON DB ────────────────────────────────────
    cases_db = _load_cases_db()
    case_data = cases_db.get(case_id)

    if case_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Case '{case_id}' not found in cases_db.json. "
                   f"Available cases: {list(cases_db.keys())}",
        )

    # Extract demo + answers
    demo = case_data.get("demo")
    answers = case_data.get("answers")
    risk_level = case_data.get("riskLevel", "Unknown")

    if demo is None or answers is None:
        raise HTTPException(
            status_code=422,
            detail=f"Case '{case_id}' is missing 'demo' or 'answers' data.",
        )

    # ── Build feature vector ──────────────────────────────────────
    X_instance = preprocess_for_inference(demo, answers, encoders)

    # ── SHAP ──────────────────────────────────────────────────────
    shap_results = compute_shap(
        model=clf,
        X_instance=X_instance,
        feature_names=FEATURE_NAMES,
    )

    # ── LIME ──────────────────────────────────────────────────────
    # X_train is needed for LIME's background distribution.
    # In mock mode or when no training data is stored, pass X_instance itself
    # (LIME will still produce reasonable local explanations).
    X_train = getattr(request.app.state, "X_train", None)
    if X_train is None:
        # Use the instance repeated as a minimal background
        X_train = X_instance

    lime_results = compute_lime(
        model=clf,
        X_instance=X_instance,
        X_train=X_train,
        feature_names=FEATURE_NAMES,
    )

    # ── Summary ───────────────────────────────────────────────────
    summary = _build_summary(risk_level, shap_results, lime_results)

    # ── Response ──────────────────────────────────────────────────
    return CombinedExplainResponse(
        caseId=case_id,
        shap=[
            {
                "feature": s["feature"],
                "shapValue": s["shap_value"],
                "direction": s["direction"],
            }
            for s in shap_results
        ],
        lime=[
            {
                "feature": l["feature"],
                "weight": l["weight"],
                "direction": l["direction"],
                "plainEnglish": l["plain_english"],
            }
            for l in lime_results
        ],
        summary=summary,
    )
