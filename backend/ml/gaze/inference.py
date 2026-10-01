"""Window scoring, session aggregation and a technically valid explanation (feature ablation)."""

from __future__ import annotations

import numpy as np
import torch

from . import preprocess as P


@torch.no_grad()
def predict_windows(model, windows: np.ndarray, norm: dict, batch: int = 256) -> np.ndarray:
    """Raw (W, L, F) windows -> (W,) ASD-class probabilities."""
    if len(windows) == 0:
        return np.zeros(0)
    x = P.to_tensor(windows, norm)
    out = [torch.sigmoid(model(x[i:i + batch])).numpy() for i in range(0, len(x), batch)]
    return np.concatenate(out).astype(float)


def aggregate(window_probs: np.ndarray) -> float:
    """Session probability = mean of window probabilities (participant-level decision unit)."""
    if len(window_probs) == 0:
        raise ValueError("no windows to aggregate")
    return float(np.mean(window_probs))


def feature_ablation(model, windows: np.ndarray, norm: dict, feature_names, base_prob: float) -> dict:
    """Replace one feature at a time with its training mean (z=0) and report the change in the
    session probability.  This is perturbation analysis, valid for any sequence model; it is a
    description of what THIS model relies on, not a causal statement about the child."""
    mean = np.asarray(norm["mean"], dtype=float)
    out = {}
    for j, name in enumerate(feature_names):
        w = windows.copy()
        w[:, :, j] = mean[j]
        out[name] = round(base_prob - aggregate(predict_windows(model, w, norm)), 4)
    return out
