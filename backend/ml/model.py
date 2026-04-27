"""Category-aware model registry and inference dispatch for NeuroSense."""

from __future__ import annotations

import joblib
import numpy as np

try:
    from .config import CATEGORY_MODEL_CONFIG, LEGACY_ADULT_ARTIFACTS
    from .preprocessor import encode_aq10_scores, preprocess_for_inference
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.config import CATEGORY_MODEL_CONFIG, LEGACY_ADULT_ARTIFACTS
    from ml.preprocessor import encode_aq10_scores, preprocess_for_inference


def _load_bundle(category: str) -> dict:
    """Load model + encoders for a single category."""
    config = CATEGORY_MODEL_CONFIG.get(category, {})
    model_path = config.get("model_path")
    encoders_path = config.get("encoders_path")
    background_path = config.get("background_path")

    bundle = {
        "model": None,
        "encoders": None,
        "background": None,
        "category": category,
    }

    # Try category-specific artifact first
    if model_path and model_path.exists():
        bundle["model"] = joblib.load(model_path)
        print(f"[NeuroSense] {category} model loaded from {model_path}")
    elif category == "adult" and LEGACY_ADULT_ARTIFACTS["model_path"].exists():
        bundle["model"] = joblib.load(LEGACY_ADULT_ARTIFACTS["model_path"])
        print(
            "[NeuroSense] adult model loaded from legacy "
            f"{LEGACY_ADULT_ARTIFACTS['model_path']}"
        )
    else:
        print(f"[NeuroSense] WARNING: No {category} model found — mock mode")

    if encoders_path and encoders_path.exists():
        bundle["encoders"] = joblib.load(encoders_path)
    elif category == "adult" and LEGACY_ADULT_ARTIFACTS["encoders_path"].exists():
        bundle["encoders"] = joblib.load(LEGACY_ADULT_ARTIFACTS["encoders_path"])

    if background_path and background_path.exists():
        bundle["background"] = np.load(background_path)

    return bundle


def load_models() -> dict:
    """
    Load all category models at startup.
    Returns { 'adult': bundle, 'child': bundle }
    """
    print("[NeuroSense] Loading model registry...")
    registry = {}
    for category in CATEGORY_MODEL_CONFIG:
        registry[category] = _load_bundle(category)
    return registry


def get_bundle(registry: dict, category: str) -> dict:
    """Get the model bundle for a specific category."""
    return registry.get(category, {"model": None, "encoders": None, "category": category})


def predict(category: str, bundle: dict, demo: dict, answers: dict) -> dict:
    """
    Run inference on a single screening submission.

    Args:
        category:  'adult' or 'child'
        bundle:    { 'model': clf, 'encoders': {...}, 'category': str }
        demo:      demographics dict
        answers:   AQ-10 answers dict (A1–A10)

    Returns:
        { 'probability', 'risk_level', 'prediction', 'mock', 'model_used' }
    """
    clf = bundle.get("model")
    encoders = bundle.get("encoders")

    # Build feature vector
    X = preprocess_for_inference(demo, answers, encoders)

    model_type = type(clf).__name__ if clf else "MockProxy"
    model_used = f"{category}_{model_type}"

    if clf is None:
        # Mock mode — use AQ-10 sum as a rough proxy
        aq_sum = sum(encode_aq10_scores(answers))
        # Slightly different mock thresholds for child vs adult
        if category == "child":
            mock_prob = min(aq_sum / 10.0 * 1.15, 1.0)  # children: slightly higher sensitivity
        else:
            mock_prob = min(aq_sum / 10.0 * 1.1, 1.0)
        return {
            "probability": round(mock_prob, 4),
            "risk_level": _classify_risk(mock_prob),
            "prediction": 1 if mock_prob >= 0.5 else 0,
            "mock": True,
            "model_used": model_used,
        }

    # Real model inference
    if hasattr(clf, "predict_proba"):
        proba = clf.predict_proba(X)[0]
        positive_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
    else:
        decision = float(clf.predict(X)[0])
        positive_prob = decision

    return {
        "probability": round(positive_prob, 4),
        "risk_level": _classify_risk(positive_prob),
        "prediction": int(clf.predict(X)[0]),
        "mock": False,
        "model_used": model_used,
    }


def _classify_risk(prob: float) -> str:
    """Map probability to risk level string."""
    if prob >= 0.7:
        return "High"
    elif prob >= 0.4:
        return "Moderate"
    else:
        return "Low"
