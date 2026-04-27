"""
ml/model.py — Load and run the ensemble model for ASD screening.

Provides:
  load_model()  — loads model.pkl and encoders.pkl from disk
  predict()     — runs inference, returns probability and risk level
"""

import os
import joblib
import numpy as np
from .preprocessor import preprocess_for_inference

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")


def load_model() -> dict:
    """
    Load the trained model and label encoders from disk.
    Returns a dict: { 'model': clf, 'encoders': {...} }
    Falls back to None if files don't exist (mock mode).
    """
    result = {"model": None, "encoders": None}

    if os.path.exists(MODEL_PATH):
        result["model"] = joblib.load(MODEL_PATH)
        print(f"[NeuroSense] Model loaded from {MODEL_PATH}")
    else:
        print(f"[NeuroSense] WARNING: No model found at {MODEL_PATH} — running in mock mode")

    if os.path.exists(ENCODERS_PATH):
        result["encoders"] = joblib.load(ENCODERS_PATH)
        print(f"[NeuroSense] Encoders loaded from {ENCODERS_PATH}")

    return result


def predict(model_bundle: dict, demo: dict, answers: dict) -> dict:
    """
    Run inference on a single screening submission.

    Args:
        model_bundle: { 'model': clf, 'encoders': {...} }
        demo:         demographics dict
        answers:      AQ-10 answers dict (A1–A10)

    Returns:
        { 'probability': float, 'risk_level': str, 'prediction': int }
    """
    clf = model_bundle.get("model")
    encoders = model_bundle.get("encoders")

    # Build feature vector
    X = preprocess_for_inference(demo, answers, encoders)

    if clf is None:
        # Mock mode — use AQ-10 sum as a rough proxy
        from .preprocessor import encode_aq10_scores
        aq_sum = sum(encode_aq10_scores(answers))
        mock_prob = min(aq_sum / 10.0 * 1.1, 1.0)  # slight amplification
        return {
            "probability": round(mock_prob, 4),
            "risk_level": _classify_risk(mock_prob),
            "prediction": 1 if mock_prob >= 0.5 else 0,
            "mock": True,
        }

    # Real model inference
    proba = clf.predict_proba(X)[0]
    positive_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])

    return {
        "probability": round(positive_prob, 4),
        "risk_level": _classify_risk(positive_prob),
        "prediction": int(clf.predict(X)[0]),
        "mock": False,
    }


def _classify_risk(prob: float) -> str:
    """Map probability to risk level string."""
    if prob >= 0.7:
        return "High"
    elif prob >= 0.4:
        return "Moderate"
    else:
        return "Low"
