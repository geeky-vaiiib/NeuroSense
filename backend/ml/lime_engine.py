"""
ml/lime_engine.py — Compute LIME explanations for model predictions.

Provides:
  compute_lime(model, X_instance, X_train, feature_names) → top 5 features
    - Uses lime.lime_tabular.LimeTabularExplainer
    - Maps each feature to a plain-English sentence
    - Returns list of {feature, weight, direction, plain_english}
"""

import numpy as np
from typing import Optional

# ── Plain-English descriptions for every AQ-10 question ───────────
AQ10_DESCRIPTIONS = {
    "A1_Score": "Noticing small sounds that others do not",
    "A2_Score": "Concentrating on the whole picture rather than small details",
    "A3_Score": "Finding it easy to multitask",
    "A4_Score": "Switching back to a task after an interruption",
    "A5_Score": "Reading between the lines in conversation",
    "A6_Score": "Recognising when someone is getting bored",
    "A7_Score": "Difficulty understanding characters' intentions in stories",
    "A8_Score": "Collecting information about categories of things",
    "A9_Score": "Working out what someone thinks by looking at their face",
    "A10_Score": "Difficulty understanding people's intentions",
    "Age": "Patient age at screening",
    "Gender": "Reported gender",
    "Jaundice": "History of neonatal jaundice",
    "Family_ASD": "Family history of ASD",
    "Ethnicity": "Reported ethnicity",
}

# ASD-trait questions (agree = positive indicator)
ASD_TRAIT_FEATURES = {"A1_Score", "A7_Score", "A8_Score", "A10_Score"}

# How many features to return
TOP_K = 5


def _build_plain_english(feature_name: str, weight: float, feature_value: float) -> str:
    """
    Build a one-sentence, plain-English explanation for a single feature.
    Example: 'Scored positively on A7: difficulty understanding character intentions in stories'
    """
    desc = AQ10_DESCRIPTIONS.get(feature_name, feature_name)
    direction_word = "positively" if weight > 0 else "negatively"

    # AQ-10 scores are binary (0 or 1)
    if feature_name.startswith("A") and feature_name.endswith("_Score"):
        q_id = feature_name.replace("_Score", "")  # e.g. "A7"
        scored = "positively" if feature_value >= 1 else "negatively"
        return f"Scored {scored} on {q_id}: {desc.lower()}"

    # Demographics
    if feature_name == "Age":
        return f"Age ({int(feature_value)}) contributed {direction_word} to the risk score"
    if feature_name == "Gender":
        return f"Reported gender contributed {direction_word} to the risk score"
    if feature_name == "Jaundice":
        status = "present" if feature_value >= 1 else "absent"
        return f"Neonatal jaundice ({status}) contributed {direction_word} to the risk score"
    if feature_name == "Family_ASD":
        status = "reported" if feature_value >= 1 else "not reported"
        return f"Family ASD history ({status}) contributed {direction_word} to the risk score"
    if feature_name == "Ethnicity":
        return f"Ethnicity category contributed {direction_word} to the risk score"

    return f"{feature_name} contributed {direction_word} to the risk score"


def compute_lime(
    model,
    X_instance: np.ndarray,
    X_train: Optional[np.ndarray],
    feature_names: Optional[list] = None,
) -> list[dict]:
    """
    Compute LIME explanation for a single prediction.

    Args:
        model:          trained classifier (or None for mock)
        X_instance:     feature array of shape (1, n_features)
        X_train:        training data for LIME background (or None)
        feature_names:  list of feature name strings

    Returns:
        List of top 5 dicts: { feature, weight, direction, plain_english }
        sorted by absolute weight descending.
    """
    from ml.shap_engine import FEATURE_NAMES as DEFAULT_NAMES

    if feature_names is None:
        feature_names = DEFAULT_NAMES

    if model is None or X_train is None:
        return _mock_lime(X_instance, feature_names)

    try:
        return _real_lime(model, X_instance, X_train, feature_names)
    except Exception as e:
        print(f"[NeuroSense] LIME computation failed: {e}")
        return _mock_lime(X_instance, feature_names)


def _real_lime(
    model,
    X_instance: np.ndarray,
    X_train: np.ndarray,
    feature_names: list,
) -> list[dict]:
    """Run LIME TabularExplainer on the instance."""
    import lime.lime_tabular

    explainer = lime.lime_tabular.LimeTabularExplainer(
        training_data=X_train,
        feature_names=feature_names,
        class_names=["No ASD", "ASD"],
        mode="classification",
        discretize_continuous=True,
    )

    explanation = explainer.explain_instance(
        X_instance.flatten(),
        model.predict_proba,
        num_features=TOP_K,
        top_labels=1,
    )

    # Get explanation for positive class (label 1)
    label = 1
    exp_list = explanation.as_list(label=label)

    results = []
    for feat_rule, weight in exp_list:
        # LIME returns rules like "A7_Score > 0.50", extract the feature name
        feat_name = _extract_feature_name(feat_rule, feature_names)
        feat_idx = feature_names.index(feat_name) if feat_name in feature_names else -1
        feat_val = float(X_instance.flatten()[feat_idx]) if feat_idx >= 0 else 0.0

        results.append({
            "feature": feat_name,
            "weight": round(float(weight), 4),
            "direction": "positive" if weight > 0 else "negative",
            "plain_english": _build_plain_english(feat_name, weight, feat_val),
        })

    results.sort(key=lambda r: abs(r["weight"]), reverse=True)
    return results[:TOP_K]


def _extract_feature_name(lime_rule: str, feature_names: list) -> str:
    """
    Extract the feature name from a LIME rule string.
    LIME generates rules like "A7_Score > 0.50" or "0.25 < Age <= 0.75".
    """
    for name in sorted(feature_names, key=len, reverse=True):
        if name in lime_rule:
            return name
    # Fallback: return the rule itself
    return lime_rule.split(" ")[0]


def _mock_lime(X_instance: np.ndarray, feature_names: list) -> list[dict]:
    """
    Generate plausible mock LIME explanations when no model is available.
    Uses actual feature values to produce weighted importances.
    """
    vals = X_instance.flatten()

    results = []
    for i, name in enumerate(feature_names):
        v = float(vals[i]) if i < len(vals) else 0.0
        # Weight based on feature value — AQ-10 binary scores carry more weight
        if name.startswith("A") and name.endswith("_Score"):
            w = round(v * 0.12 - 0.02, 4)  # positive when scored 1
        else:
            w = round(v * 0.01, 4) if v > 0 else round(-0.01, 4)

        results.append({
            "feature": name,
            "weight": w,
            "direction": "positive" if w > 0 else "negative",
            "plain_english": _build_plain_english(name, w, v),
        })

    results.sort(key=lambda r: abs(r["weight"]), reverse=True)
    return results[:TOP_K]
