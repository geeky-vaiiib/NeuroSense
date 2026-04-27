"""
routers/explainability.py — GET /explain/{caseId} endpoint.

Returns SHAP feature-importance values for a given case.
"""

from fastapi import APIRouter, Request, HTTPException
from schemas.screening import ExplainResponse
from ml.shap_engine import compute_shap_values
from ml.preprocessor import preprocess_for_inference
import numpy as np

router = APIRouter(prefix="/explain", tags=["Explainability"])

# ── Mock feature vectors per case (for demo) ──────────────────────
# In production these would come from a database
MOCK_CASE_FEATURES = {
    "NS-2024-001": {
        "demo": {"age": 34, "gender": "Non-binary", "jaundice": "No", "familyAsd": "No", "ethnicity": "South Asian"},
        "answers": {f"A{i}": "Definitely agree" for i in range(1, 11)},
    },
    "NS-2024-005": {
        "demo": {"age": 19, "gender": "Female", "jaundice": "Yes", "familyAsd": "Yes", "ethnicity": "White-Caucasian"},
        "answers": {f"A{i}": ("Definitely agree" if i in {1, 7, 8, 10} else "Slightly disagree") for i in range(1, 11)},
    },
}


@router.get("/{case_id}", response_model=ExplainResponse)
async def explain_case(case_id: str, request: Request):
    """
    Compute SHAP feature importances for a screened case.
    Uses the loaded model for real explanations, or mock values if no model.
    """
    model_bundle = request.app.state.model_bundle

    # Get feature data for this case
    case_data = MOCK_CASE_FEATURES.get(case_id)
    if case_data is None:
        # Generate a default feature vector
        case_data = {
            "demo": {"age": 25, "gender": "Male", "jaundice": "No", "familyAsd": "No", "ethnicity": "Other"},
            "answers": {f"A{i}": "Slightly agree" for i in range(1, 11)},
        }

    encoders = model_bundle.get("encoders") if model_bundle else None
    X = preprocess_for_inference(case_data["demo"], case_data["answers"], encoders)

    shap_result = compute_shap_values(model_bundle, X)

    return ExplainResponse(
        caseId=case_id,
        baseValue=shap_result["base_value"],
        outputValue=shap_result["output_value"],
        features=shap_result["features"],
    )
