"""Category-aware model registry and inference dispatch for NeuroSense."""

from __future__ import annotations

import joblib
import numpy as np

try:
    from .config import CATEGORY_MODEL_CONFIG, LEGACY_ADULT_ARTIFACTS
    from .preprocessor import preprocess_for_inference
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.config import CATEGORY_MODEL_CONFIG, LEGACY_ADULT_ARTIFACTS
    from ml.preprocessor import preprocess_for_inference


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
    Returns { 'adult': bundle, 'child': bundle, 'toddler': bundle }
    """
    print("[NeuroSense] Loading model registry...")
    registry = {}
    for category, cfg in CATEGORY_MODEL_CONFIG.items():
        if cfg.get("legacy"):
            continue                      # superseded models are never loaded
        registry[category] = _load_bundle(category)
    return registry


def get_bundle(registry: dict, category: str) -> dict:
    """Get the model bundle for a specific category."""
    return registry.get(category, {"model": None, "encoders": None, "category": category})


def predict(category: str, bundle: dict, demo: dict, answers: dict):
    """Output of the questionnaire ML model for one submission, or ``None`` when no model is loaded.

    There is no mock/proxy fallback: the screening result does not depend on this output (it is computed from the
    score in ml/questionnaire_score.py).  The model was trained on labels that are a threshold on the item total, so
    its output reproduces the scoring rule and is NOT an independently validated probability.
    """
    clf = bundle.get("model")
    if clf is None:
        return None
    X = preprocess_for_inference(demo, answers, bundle.get("encoders"), category=category)
    if hasattr(clf, "predict_proba"):
        proba = clf.predict_proba(X)[0]
        positive = float(proba[1]) if len(proba) > 1 else float(proba[0])
    else:
        positive = float(clf.predict(X)[0])
    return {
        "probability": round(positive, 4), "prediction": int(clf.predict(X)[0]),
        "model_used": f"{category}_{type(clf).__name__}",
        "role": "model of the scoring rule; shown for transparency, does not affect the result",
        "validated_against_clinical_labels": False,
    }
