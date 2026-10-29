"""
ml/shap_engine.py — Compute SHAP values for model explainability.

Provides:
  compute_shap(model, X_instance, feature_names) → top 8 features
    - Uses TreeExplainer for XGBoost / GradientBoosting
    - Uses KernelExplainer as fallback for AdaBoost (no native tree path)
    - Returns list of {feature, shap_value, direction} sorted by |shap_value| desc
"""

import numpy as np
from typing import Optional

try:
    from .config import FEATURE_NAMES
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.config import FEATURE_NAMES

# How many features to return
TOP_K = 8


def compute_shap(
    model,
    X_instance: np.ndarray,
    feature_names: Optional[list] = None,
    background: Optional[np.ndarray] = None,
) -> Optional[list[dict]]:
    """Local SHAP values (impact on the positive-class output of ``model``) for one instance.

    Returns ``None`` when no model is loaded or SHAP fails - there is no placeholder/mock output.
    ``background`` is the training-data reference used by KernelExplainer (AdaBoost); it must NOT be the instance
    itself (a one-row background gives all-zero attributions).
    """
    if model is None:
        return None
    if feature_names is None:
        feature_names = FEATURE_NAMES
    try:
        return _real_shap(model, X_instance, feature_names, background)
    except Exception as e:
        print(f"[NeuroSense] SHAP computation failed: {e}")
        return None


def _real_shap(model, X_instance: np.ndarray, feature_names: list, background: Optional[np.ndarray] = None) -> list[dict]:
    """TreeExplainer for tree ensembles with native support, otherwise KernelExplainer against a real training background."""
    import shap

    model_type = type(model).__name__
    if model_type in ("XGBClassifier", "GradientBoostingClassifier"):
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_instance)
    else:
        if background is None or len(background) < 2:
            raise ValueError("a multi-row training background is required for this model type")
        ref = shap.sample(background, min(50, len(background)), random_state=0)
        explainer = shap.KernelExplainer(model.predict_proba, ref)
        shap_values = explainer.shap_values(X_instance, silent=True)

    if isinstance(shap_values, list):               # [negative class, positive class]
        sv = np.asarray(shap_values[1])
    else:
        sv = np.asarray(shap_values)
        if sv.ndim == 3:                            # (n, features, classes) in newer shap versions
            sv = sv[:, :, 1]

    results = []
    for i, name in enumerate(feature_names):
        if i >= sv.shape[1]:
            break
        val = float(sv[0][i])
        results.append({"feature": name, "shap_value": round(val, 4), "direction": "positive" if val > 0 else "negative"})
    results.sort(key=lambda r: abs(r["shap_value"]), reverse=True)
    return results[:TOP_K]
