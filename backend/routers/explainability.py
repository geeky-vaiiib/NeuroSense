"""Explainability endpoints for category-aware screening cases."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, HTTPException, Request

try:
    from ..core.categories import build_interpretation, category_label, feature_label
    from ..core.cases_store import get_case_record
    from ..ml.lime_engine import compute_lime
    from ..ml.model import get_bundle
    from ..ml.preprocessor import preprocess_for_inference
    from ..ml.shap_engine import FEATURE_NAMES, compute_shap
    from ..schemas.screening import CombinedExplainResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.categories import build_interpretation, category_label, feature_label
    from core.cases_store import get_case_record
    from ml.lime_engine import compute_lime
    from ml.model import get_bundle
    from ml.preprocessor import preprocess_for_inference
    from ml.shap_engine import FEATURE_NAMES, compute_shap
    from schemas.screening import CombinedExplainResponse

router = APIRouter(prefix="/explain", tags=["Explainability"])

def _background_matrix(bundle: dict, X_instance: np.ndarray) -> np.ndarray:
    background = bundle.get("background")
    if isinstance(background, np.ndarray) and background.size:
        return background

    base = X_instance.astype(np.float64)
    return np.vstack(
        [
            base,
            np.clip(base * 0.95, 0, None),
            np.clip(base * 1.05, 0, None),
            np.clip(base + 0.5, 0, None),
            np.clip(base - 0.5, 0, None),
        ]
    )


def _build_summary(case_data: dict, shap_results: list[dict]) -> str:
    interpretation = build_interpretation(case_data["category"], case_data["risk_level"])
    if not shap_results:
        return interpretation

    top_features = ", ".join(item["feature"] for item in shap_results[:2])
    return (
        f"{interpretation} The strongest contributing signals in the "
        f"{category_label(case_data['category']).lower()} model were {top_features}."
    )


@router.get("/{case_id}", response_model=CombinedExplainResponse)
async def explain_case(case_id: str, request: Request):
    """Compute SHAP + LIME explanations — category-aware."""
    registry = request.app.state.model_registry or {}
    case_data = get_case_record(case_id)

    if case_data is None:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    category = case_data["category"]
    demo = case_data.get("demo", {})
    answers = case_data.get("answers", {})
    risk_level = case_data.get("risk_level", "Low")

    bundle = get_bundle(registry, category)
    clf = bundle.get("model")
    encoders = bundle.get("encoders")
    is_mock = bool(case_data.get("is_mock", clf is None))
    model_used = case_data.get("model_used") or (
        f"{category}_{type(clf).__name__}" if clf else f"{category}_MockProxy"
    )

    X_instance = preprocess_for_inference(demo, answers, encoders, category=category)
    background = _background_matrix(bundle, X_instance)

    shap_results = compute_shap(model=clf, X_instance=X_instance, feature_names=FEATURE_NAMES)
    lime_results = compute_lime(
        model=clf,
        X_instance=X_instance,
        X_train=background,
        feature_names=FEATURE_NAMES,
    )

    formatted_shap = [
        {
            "feature": feature_label(item["feature"], category),
            "shapValue": item["shap_value"],
            "direction": item["direction"],
        }
        for item in shap_results
    ]
    formatted_lime = [
        {
            "feature": feature_label(item["feature"], category),
            "weight": item["weight"],
            "direction": item["direction"],
            "plainEnglish": item["plain_english"],
        }
        for item in lime_results
    ]
    summary = _build_summary(
        case_data,
        [{"feature": item["feature"], "direction": item["direction"]} for item in formatted_shap],
    )

    return CombinedExplainResponse(
        caseId=case_id,
        category=category,
        categoryLabel=category_label(category),
        modelUsed=model_used,
        isMock=is_mock,
        dataSource=case_data.get("data_source", "mock" if is_mock else "model"),
        shap=formatted_shap,
        lime=formatted_lime,
        summary=summary,
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )
