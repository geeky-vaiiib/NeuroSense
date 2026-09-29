"""Gaze preprocessing shared by training and inference (the only implementation).

canonical samples -> validate -> I-DT fixation flag -> 10 Hz resample ->
[x, y, speed, is_fixation] -> normalise -> pad/truncate to SEQ_LEN.

Every function is pure numpy; nothing here depends on FastAPI or torch.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Optional

import numpy as np

from . import config as C

SOCIAL_STIMULI = frozenset({"happy_face", "neutral_face"})


# ── 1. Validation ────────────────────────────────────────────────────────────

@dataclass
class CleanedSamples:
    t_ms: np.ndarray                 # (N,) float64, strictly increasing
    x: np.ndarray                    # (N,) normalised to [0, 1]
    y: np.ndarray
    stimulus: list[Optional[str]]
    n_total: int = 0
    rejected: dict[str, int] = field(default_factory=dict)

    @property
    def n_valid(self) -> int:
        return int(len(self.t_ms))

    @property
    def valid_ratio(self) -> float:
        return self.n_valid / self.n_total if self.n_total else 0.0


def validate_samples(
    samples: Iterable[Mapping], screen_w: float, screen_h: float
) -> CleanedSamples:
    """Apply the documented per-sample rejection rules.

    Rules (a sample is dropped, and counted, at the first one it violates):
      non_finite          timestamp / x / y is NaN or +-inf
      negative_timestamp  timestamp < 0
      non_monotonic       timestamp <= the largest timestamp seen so far
      face_not_detected   face_detected is False
      out_of_bounds       x or y outside [0, screen] (predictions off the screen)
    """
    rejected = {k: 0 for k in (
        "non_finite", "negative_timestamp", "non_monotonic",
        "face_not_detected", "out_of_bounds",
    )}
    t_out: list[float] = []
    x_out: list[float] = []
    y_out: list[float] = []
    stim: list[Optional[str]] = []
    n_total = 0
    last_t = -math.inf

    for s in samples:
        n_total += 1
        try:
            t = float(s["timestamp"])
        except (KeyError, TypeError, ValueError):
            rejected["non_finite"] += 1
            continue
        if not math.isfinite(t):
            rejected["non_finite"] += 1
            continue
        if t < 0:
            rejected["negative_timestamp"] += 1
            continue
        if t <= last_t:
            rejected["non_monotonic"] += 1
            continue
        last_t = t
        if s.get("face_detected", True) is False:
            rejected["face_not_detected"] += 1
            continue
        try:
            x = float(s["x"])
            y = float(s["y"])
        except (KeyError, TypeError, ValueError):
            rejected["non_finite"] += 1
            continue
        if not (math.isfinite(x) and math.isfinite(y)):
            rejected["non_finite"] += 1
            continue
        if not (0.0 <= x <= screen_w and 0.0 <= y <= screen_h):
            rejected["out_of_bounds"] += 1
            continue
        t_out.append(t)
        x_out.append(x / screen_w)
        y_out.append(y / screen_h)
        sid = s.get("stimulus_id")
        stim.append(None if sid is None else str(sid))

    return CleanedSamples(
        t_ms=np.asarray(t_out, dtype=np.float64),
        x=np.asarray(x_out, dtype=np.float64),
        y=np.asarray(y_out, dtype=np.float64),
        stimulus=stim,
        n_total=n_total,
        rejected=rejected,
    )


def compute_dt(t_ms: np.ndarray) -> np.ndarray:
    """Server-side dt (ms) between consecutive valid samples; first entry is 0."""
    if len(t_ms) == 0:
        return np.zeros(0)
    return np.concatenate([[0.0], np.diff(t_ms)])


def segment_bounds(t_ms: np.ndarray) -> list[tuple[int, int]]:
    """Half-open index ranges of runs whose consecutive gaps are <= MAX_GAP_MS."""
    n = len(t_ms)
    if n == 0:
        return []
    breaks = np.where(np.diff(t_ms) > C.MAX_GAP_MS)[0] + 1
    starts = np.concatenate([[0], breaks])
    ends = np.concatenate([breaks, [n]])
    return list(zip(starts.tolist(), ends.tolist()))


# ── 2. Fixation flag (I-DT) ──────────────────────────────────────────────────

def detect_fixations(t_ms: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """I-DT: a run of samples lasting >= FIXATION_MIN_MS whose dispersion
    (x-range + y-range, normalised coordinates) stays <= FIXATION_DISPERSION.
    Windows never span a gap > MAX_GAP_MS.  Returns a float32 0/1 array.
    """
    n = len(t_ms)
    flag = np.zeros(n, dtype=np.float32)
    for lo, hi in segment_bounds(t_ms):
        i = lo
        while i < hi:
            j = i
            xmin = xmax = x[i]
            ymin = ymax = y[i]
            while j + 1 < hi:
                nx0, nx1 = min(xmin, x[j + 1]), max(xmax, x[j + 1])
                ny0, ny1 = min(ymin, y[j + 1]), max(ymax, y[j + 1])
                if (nx1 - nx0) + (ny1 - ny0) > C.FIXATION_DISPERSION:
                    break
                xmin, xmax, ymin, ymax = nx0, nx1, ny0, ny1
                j += 1
            if t_ms[j] - t_ms[i] >= C.FIXATION_MIN_MS:
                flag[i:j + 1] = 1.0
                i = j + 1
            else:
                i += 1
    return flag


# ── 3. Resample + feature matrix ─────────────────────────────────────────────

def build_feature_matrix(cleaned: CleanedSamples) -> np.ndarray:
    """(T, len(FEATURE_NAMES)) float32, un-normalised, T <= SEQ_LEN.

    Each gap-free segment (>= 2 samples) is resampled to a RESAMPLE_HZ grid
    (linear x/y, nearest fixation flag); segments are concatenated in time
    order with gaps removed.  speed = |d(x,y)| * RESAMPLE_HZ (screen-widths/s
    on the normalised axes); the first step of a segment has speed 0.
    """
    t, x, y = cleaned.t_ms, cleaned.x, cleaned.y
    if len(t) < 2:
        return np.zeros((0, len(C.FEATURE_NAMES)), dtype=np.float32)
    fix = detect_fixations(t, x, y)

    rows: list[np.ndarray] = []
    for lo, hi in segment_bounds(t):
        if hi - lo < 2:
            continue
        ts, xs, ys, fs = t[lo:hi], x[lo:hi], y[lo:hi], fix[lo:hi]
        grid = np.arange(ts[0], ts[-1] + 1e-9, C.STEP_MS)
        gx = np.interp(grid, ts, xs)
        gy = np.interp(grid, ts, ys)
        idx = np.clip(np.searchsorted(ts, grid), 0, len(ts) - 1)
        prev = np.clip(idx - 1, 0, len(ts) - 1)
        nearest = np.where(np.abs(ts[idx] - grid) <= np.abs(ts[prev] - grid), idx, prev)
        gf = fs[nearest]
        speed = np.zeros(len(grid))
        if len(grid) > 1:
            speed[1:] = np.hypot(np.diff(gx), np.diff(gy)) * C.RESAMPLE_HZ
        rows.append(np.stack([gx, gy, speed, gf], axis=1))

    if not rows:
        return np.zeros((0, len(C.FEATURE_NAMES)), dtype=np.float32)
    feats = np.concatenate(rows, axis=0).astype(np.float32)
    return feats[: C.SEQ_LEN]


def normalize(feats: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    return ((feats - mean) / std).astype(np.float32)


def pad_sequence(feats: np.ndarray) -> tuple[np.ndarray, int]:
    """Zero-pad (after normalisation) to (SEQ_LEN, F); returns (array, real_length)."""
    real = min(len(feats), C.SEQ_LEN)
    out = np.zeros((C.SEQ_LEN, len(C.FEATURE_NAMES)), dtype=np.float32)
    out[:real] = feats[:real]
    return out, real


# ── 4. Human-readable session summary (display only, never fed to the model) ─

def summarize(cleaned: CleanedSamples) -> dict:
    n = cleaned.n_valid
    if n < 2:
        return {}
    t, x, y = cleaned.t_ms, cleaned.x, cleaned.y
    fix = detect_fixations(t, x, y)

    durations: list[float] = []
    start: Optional[float] = None
    for i in range(n):
        if fix[i] and start is None:
            start = t[i]
        if start is not None and (not fix[i] or i == n - 1 or t[i + 1] - t[i] > C.MAX_GAP_MS):
            durations.append(float(t[i] - start))
            start = None
    stim = cleaned.stimulus
    social = sum(1 for s in stim if s in SOCIAL_STIMULI)
    transitions = sum(1 for i in range(1, n) if stim[i] != stim[i - 1])
    steps = np.hypot(np.diff(x), np.diff(y))
    steps = steps[np.diff(t) <= C.MAX_GAP_MS]
    return {
        "fixation_ratio": round(float(fix.mean()), 4),
        "mean_fixation_duration": round(float(np.mean(durations)), 1) if durations else 0.0,
        "gaze_variability": round(float((np.std(x) + np.std(y)) / 2), 4),
        "scanpath_length": round(float(steps.sum()), 4),
        "social_attention_ratio": round(social / n, 4),
        "stimulus_transitions": int(transitions),
        "duration_s": round(float((t[-1] - t[0]) / 1000.0), 2),
    }
