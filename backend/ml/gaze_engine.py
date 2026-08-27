"""Gaze-coordinate risk scoring for NeuroSense eye-tracking step.

Receives a sequence of {x, y, timestamp, stimulus} dicts captured by the
frontend GazeSession component and returns a 0–1 risk probability score.

Strategy:
    • If a trained LSTM checkpoint exists at  backend/models/gaze_lstm.pt ,
      it is loaded once at module level and used for inference.
    • Otherwise a rule-based heuristic derived from validated clinical
      literature (Jones & Klin 2013; Klin et al. 2002) is used, and the
      response is flagged  isMock=True .

The heuristic will be retired once real training data is available and the
LSTM is promoted to production.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

# ── LSTM model discovery ────────────────────────────────────────────────────
_LSTM_PATH = Path(__file__).resolve().parent.parent / "models" / "gaze_lstm.pt"


def _load_lstm() -> Any | None:
    """Attempt to load a trained LSTM checkpoint.  Returns *None* on any
    failure so the heuristic fallback activates silently."""
    if not _LSTM_PATH.exists():
        return None
    try:
        import torch  # noqa: F401 — optional dependency

        model = torch.load(_LSTM_PATH, map_location="cpu", weights_only=False)
        model.eval()
        print(f"[NeuroSense] Gaze LSTM loaded from {_LSTM_PATH}")
        return model
    except Exception as exc:  # pragma: no cover
        print(f"[NeuroSense] Gaze LSTM load failed ({exc}) — falling back to heuristic")
        return None


_GAZE_MODEL = _load_lstm()

# ── Constants ───────────────────────────────────────────────────────────────
_MIN_POINTS = 20
_FIXATION_RADIUS = 50  # px — cluster threshold for fixation grouping
_SOCIAL_STIMULI = {0, 1}  # happy face, neutral face


# ── Public API ──────────────────────────────────────────────────────────────

def compute_gaze_score(
    gaze_points: list[dict],
    category: str = "adult",
) -> dict:
    """Score a raw gaze-point sequence and return risk assessment.

    Parameters
    ----------
    gaze_points : list[dict]
        Each dict has keys ``x`` (float 0–1), ``y`` (float 0–1),
        ``timestamp`` (float, Unix ms), and ``stimulus`` (int 0–4).
    category : str
        ``"adult"`` or ``"child"``.  Toddler track never calls this
        module (caregiver report only).

    Returns
    -------
    dict
        ``{ score, isMock, features, interpretation }``
    """

    # ── Guard: insufficient data ────────────────────────────────────────
    if not gaze_points or len(gaze_points) < _MIN_POINTS:
        return {
            "score": None,
            "isMock": True,
            "features": {},
            "interpretation": (
                "Insufficient gaze data — step was skipped or too few "
                "points recorded."
            ),
        }

    # ── LSTM path (when a checkpoint is available) ──────────────────────
    if _GAZE_MODEL is not None:
        return _predict_lstm(gaze_points, category)

    # ── Heuristic path ──────────────────────────────────────────────────
    return _predict_heuristic(gaze_points, category)


# ── LSTM inference ──────────────────────────────────────────────────────────

def _predict_lstm(gaze_points: list[dict], category: str) -> dict:
    """Run inference through the trained LSTM checkpoint."""
    import torch  # guaranteed available if _GAZE_MODEL loaded

    # Build a padded tensor of shape (1, T, 4) — [x, y, dt, stimulus]
    rows: list[list[float]] = []
    prev_ts = gaze_points[0].get("timestamp", 0)
    for pt in gaze_points:
        ts = pt.get("timestamp", 0)
        dt = ts - prev_ts
        prev_ts = ts
        rows.append([
            float(pt.get("x", 0)),
            float(pt.get("y", 0)),
            float(dt),
            float(pt.get("stimulus", 0)),
        ])
    tensor = torch.tensor([rows], dtype=torch.float32)

    with torch.no_grad():
        output = _GAZE_MODEL(tensor)
        # Expect a single logit or probability per sample
        if output.dim() > 1:
            prob = torch.sigmoid(output[0, -1]).item()
        else:
            prob = torch.sigmoid(output[0]).item()

    features = _extract_features(gaze_points)

    return {
        "score": round(prob, 4),
        "isMock": False,
        "features": features,
        "interpretation": _interpret(prob),
    }


# ── Heuristic inference ────────────────────────────────────────────────────

def _predict_heuristic(gaze_points: list[dict], category: str) -> dict:
    """Clinical-heuristic scoring (Jones & Klin 2013)."""
    features = _extract_features(gaze_points)

    # ── Normalize each feature to a 0–1 risk signal ─────────────────────
    sar = features["social_attention_ratio"]
    risk_social = 1.0 - min(sar / 0.7, 1.0)

    risk_var = min(features["gaze_variability"] / 0.5, 1.0)

    risk_scan = min(features["scanpath_length"] / 2.0, 1.0)

    mfd = features["mean_fixation_duration"]
    risk_fix = 1.0 - min(mfd / 300.0, 1.0)

    # ── Weighted combination ────────────────────────────────────────────
    score = (
        0.40 * risk_social
        + 0.25 * risk_var
        + 0.20 * risk_scan
        + 0.15 * risk_fix
    )
    score = round(max(0.0, min(score, 1.0)), 4)

    return {
        "score": score,
        "isMock": True,
        "features": features,
        "interpretation": _interpret(score),
    }


# ── Feature extraction ─────────────────────────────────────────────────────

def _extract_features(gaze_points: list[dict]) -> dict:
    """Derive the five clinical features from a raw gaze-point sequence.

    All spatial values assume *x* and *y* are normalised to 0–1.  Where
    pixel distances are needed (fixation clustering), the coordinates are
    scaled to a virtual 1000×1000 canvas.
    """
    n = len(gaze_points)

    xs = [float(p.get("x", 0)) for p in gaze_points]
    ys = [float(p.get("y", 0)) for p in gaze_points]
    timestamps = [float(p.get("timestamp", 0)) for p in gaze_points]
    stimuli = [int(p.get("stimulus", 0)) for p in gaze_points]

    # 1. mean_fixation_duration — cluster consecutive points within 50px
    #    on a virtual 1000×1000 canvas
    fixation_durations = _compute_fixation_durations(xs, ys, timestamps)
    mean_fixation_duration = (
        sum(fixation_durations) / len(fixation_durations)
        if fixation_durations
        else 0.0
    )

    # 2. social_attention_ratio
    social_count = sum(1 for s in stimuli if s in _SOCIAL_STIMULI)
    social_attention_ratio = social_count / n if n > 0 else 0.0

    # 3. gaze_variability — average of std(x) and std(y)
    gaze_variability = (_std(xs) + _std(ys)) / 2.0

    # 4. scanpath_length — total Euclidean distance / number of points
    total_dist = 0.0
    for i in range(1, n):
        dx = xs[i] - xs[i - 1]
        dy = ys[i] - ys[i - 1]
        total_dist += math.sqrt(dx * dx + dy * dy)
    scanpath_length = total_dist / n if n > 0 else 0.0

    # 5. stimulus_transitions
    transitions = sum(
        1 for i in range(1, n) if stimuli[i] != stimuli[i - 1]
    )

    return {
        "mean_fixation_duration": round(mean_fixation_duration, 2),
        "social_attention_ratio": round(social_attention_ratio, 4),
        "gaze_variability": round(gaze_variability, 4),
        "scanpath_length": round(scanpath_length, 4),
        "stimulus_transitions": transitions,
    }


# ── Helpers ─────────────────────────────────────────────────────────────────

def _compute_fixation_durations(
    xs: list[float],
    ys: list[float],
    timestamps: list[float],
) -> list[float]:
    """Group consecutive gaze points into fixation clusters and return
    each cluster's duration in milliseconds.

    A new fixation starts whenever a point is >``_FIXATION_RADIUS`` px
    from the running centroid on a virtual 1000×1000 canvas.
    """
    if len(xs) < 2:
        return []

    scale = 1000.0  # virtual canvas side length
    durations: list[float] = []

    cx, cy = xs[0] * scale, ys[0] * scale
    cluster_start = timestamps[0]
    cluster_count = 1

    for i in range(1, len(xs)):
        px, py = xs[i] * scale, ys[i] * scale
        dist = math.sqrt((px - cx) ** 2 + (py - cy) ** 2)

        if dist <= _FIXATION_RADIUS:
            # Still within cluster — update running centroid
            cluster_count += 1
            cx += (px - cx) / cluster_count
            cy += (py - cy) / cluster_count
        else:
            # Close current cluster
            duration = timestamps[i - 1] - cluster_start
            if duration > 0:
                durations.append(duration)
            # Start new cluster
            cx, cy = px, py
            cluster_start = timestamps[i]
            cluster_count = 1

    # Close final cluster
    final_duration = timestamps[-1] - cluster_start
    if final_duration > 0:
        durations.append(final_duration)

    return durations


def _std(values: list[float]) -> float:
    """Population standard deviation."""
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    return math.sqrt(variance)


def _interpret(score: float) -> str:
    """Return a plain-English interpretation sentence."""
    if score >= 0.65:
        return (
            "Gaze patterns show reduced social attention and elevated "
            "fixation variability, consistent with ASD-related eye "
            "movement profiles."
        )
    if score >= 0.40:
        return (
            "Gaze patterns show moderate deviation from typical social "
            "attention profiles."
        )
    return (
        "Gaze patterns show relatively typical social attention and "
        "fixation behaviour."
    )
