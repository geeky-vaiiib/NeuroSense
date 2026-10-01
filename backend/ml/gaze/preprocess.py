"""The ONLY gaze preprocessing implementation (training and inference both call it).

Pure numpy/pandas; no torch, no FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from . import config as C
from .config import PreprocessConfig

POSE_FEATURES = {"head_pose_x": "pose_Rx", "head_pose_y": "pose_Ry", "head_pose_z": "pose_Rz"}


class SchemaError(ValueError):
    """Required OpenFace columns are missing / the file is not OpenFace output."""


# ── 1. column selection ──────────────────────────────────────────────────────

def standardize_frame(df: pd.DataFrame, cfg: PreprocessConfig = C.DEPLOYED) -> pd.DataFrame:
    """Strip OpenFace's leading-space column names and keep only what the schema needs."""
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    needed = list(C.REQUIRED_COLUMNS)
    for fname in cfg.feature_names:
        if fname in POSE_FEATURES:
            needed.append(POSE_FEATURES[fname])
    missing = [c for c in dict.fromkeys(needed) if c not in df.columns]
    if missing:
        raise SchemaError(f"OpenFace output is missing required columns: {missing}")
    return df[list(dict.fromkeys(needed))].apply(pd.to_numeric, errors="coerce")


# ── 2. frame cleaning ────────────────────────────────────────────────────────

@dataclass
class CleanedFrames:
    t: np.ndarray                    # (N,) seconds, strictly increasing, valid frames only
    values: dict                     # name -> (N,) arrays (gaze_angle_x/y, pose_*)
    confidence: np.ndarray           # (N,) of kept frames
    n_total: int
    rejected: dict = field(default_factory=dict)
    mean_confidence_all: Optional[float] = None   # over every frame OpenFace returned

    @property
    def n_valid(self) -> int:
        return int(len(self.t))


def clean_frames(df: pd.DataFrame, cfg: PreprocessConfig = C.DEPLOYED) -> CleanedFrames:
    """Reject bad frames (counted, never silently): timestamp, success/no-face, low confidence,
    non-finite or impossible gaze, impossible frame-to-frame jump."""
    d = standardize_frame(df, cfg)
    n_total = len(d)
    rej = dict.fromkeys(
        ("invalid_timestamp", "non_monotonic", "no_face", "low_confidence",
         "invalid_gaze", "impossible_jump"), 0)
    pose_cols = [c for c in d.columns if c.startswith("pose_")]

    ts = d["timestamp"].to_numpy(float)
    keep = np.ones(n_total, bool)

    bad = ~np.isfinite(ts) | (ts < 0)
    rej["invalid_timestamp"] = int(bad.sum()); keep &= ~bad

    # non-monotonic: timestamp not strictly greater than the running maximum of kept frames
    run_max = -np.inf
    for i in range(n_total):
        if not keep[i]:
            continue
        if ts[i] <= run_max:
            keep[i] = False; rej["non_monotonic"] += 1
        else:
            run_max = ts[i]

    succ = d["success"].to_numpy(float)
    bad = keep & ~(succ == 1)
    rej["no_face"] = int(bad.sum()); keep &= ~bad

    conf = d["confidence"].to_numpy(float)
    mean_all = float(np.nanmean(conf)) if np.isfinite(conf).any() else None
    bad = keep & ~(np.isfinite(conf) & (conf >= C.MIN_CONFIDENCE))
    rej["low_confidence"] = int(bad.sum()); keep &= ~bad

    gx, gy = d["gaze_angle_x"].to_numpy(float), d["gaze_angle_y"].to_numpy(float)
    bad = keep & ~(np.isfinite(gx) & np.isfinite(gy)
                   & (np.abs(gx) <= C.MAX_ABS_GAZE_ANGLE) & (np.abs(gy) <= C.MAX_ABS_GAZE_ANGLE))
    for pc in pose_cols:
        bad |= keep & ~np.isfinite(d[pc].to_numpy(float))
    rej["invalid_gaze"] = int(bad.sum()); keep &= ~bad

    # impossible jumps relative to the previous kept frame (iterative so one outlier
    # does not take its neighbours with it)
    idx = np.flatnonzero(keep)
    last = None
    for i in idx:
        if last is not None:
            dt = ts[i] - ts[last]
            speed = np.hypot(gx[i] - gx[last], gy[i] - gy[last]) / dt
            if speed > C.MAX_GAZE_SPEED:
                keep[i] = False; rej["impossible_jump"] += 1
                continue
        last = i

    values = {"gaze_angle_x": gx[keep], "gaze_angle_y": gy[keep]}
    for pc in pose_cols:
        values[pc] = d[pc].to_numpy(float)[keep]
    return CleanedFrames(t=ts[keep], values=values, confidence=conf[keep],
                         n_total=n_total, rejected=rej, mean_confidence_all=mean_all)


# ── 3. resampling ────────────────────────────────────────────────────────────

@dataclass
class Resampled:
    grid: dict                # name -> (T,) arrays on the fixed grid (NaN in holes)
    hole: np.ndarray          # (T,) True where no real frame within MAX_GAP_S
    hz: int


def resample(cl: CleanedFrames, cfg: PreprocessConfig = C.DEPLOYED) -> Resampled:
    """Linear interpolation onto a fixed grid; steps inside a gap longer than MAX_GAP_S are holes.
    A fixed grid removes the recording frame-rate (22.4 vs 24.4 fps between DASD classes) as a cue."""
    if cl.n_valid < 2:
        return Resampled({k: np.zeros(0) for k in cl.values}, np.zeros(0, bool), cfg.resample_hz)
    t0, t1 = cl.t[0], cl.t[-1]
    n = int(np.floor((t1 - t0) * cfg.resample_hz)) + 1
    grid_t = t0 + np.arange(n) / cfg.resample_hz
    # gap test: distance between the surrounding real frames
    right = np.searchsorted(cl.t, grid_t, side="left").clip(1, cl.n_valid - 1)
    left = right - 1
    span = cl.t[right] - cl.t[left]
    hole = span > C.MAX_GAP_S
    out = {k: np.interp(grid_t, cl.t, v) for k, v in cl.values.items()}
    for v in out.values():
        v[hole] = np.nan
    return Resampled(out, hole, cfg.resample_hz)


# ── 4. features / normalisation ──────────────────────────────────────────────

def build_features(rs: Resampled, cfg: PreprocessConfig = C.DEPLOYED) -> np.ndarray:
    """(T, F) raw (un-normalised) feature matrix in cfg.feature_names order; NaN in holes."""
    T = len(rs.hole)
    cols = []
    for name in cfg.feature_names:
        if name in ("gaze_angle_x", "gaze_angle_y"):
            cols.append(rs.grid[name])
        elif name in ("gaze_vel_x", "gaze_vel_y"):
            base = rs.grid["gaze_angle_" + name[-1]]
            v = np.full(T, np.nan)
            if T > 1:
                v[1:] = np.diff(base) * rs.hz
            cols.append(v)
        elif name in POSE_FEATURES:
            cols.append(rs.grid[POSE_FEATURES[name]])
        else:
            raise SchemaError(f"unknown feature {name!r}")
    return np.stack(cols, axis=1) if cols else np.zeros((T, 0))


def make_windows(feats: np.ndarray, hole: np.ndarray, cfg: PreprocessConfig = C.DEPLOYED) -> np.ndarray:
    """Slide a fixed window over the session.  Windows with too many hole steps are dropped;
    remaining holes are filled with the window mean (position) / 0 (velocity).  -> (W, L, F)."""
    L, S = cfg.window_steps, cfg.stride_steps
    T = len(feats)
    wins = []
    for a in range(0, T - L + 1, S):
        seg = feats[a:a + L].copy()
        h = hole[a:a + L] | ~np.isfinite(seg).all(axis=1)
        if (1 - h.mean()) < cfg.min_window_coverage:
            continue
        for j, name in enumerate(cfg.feature_names):
            col = seg[:, j]
            fill = 0.0 if "vel" in name else float(np.nanmean(col[~h]))
            col[h] = fill
        if cfg.center_window:
            for j, name in enumerate(cfg.feature_names):
                if "vel" not in name:
                    seg[:, j] -= seg[:, j].mean()
        wins.append(seg)
    return np.stack(wins) if wins else np.zeros((0, L, len(cfg.feature_names)))


def fit_normalizer(windows: np.ndarray) -> dict:
    """Per-feature mean/std from TRAINING windows only (stored in the checkpoint metadata)."""
    flat = windows.reshape(-1, windows.shape[-1])
    std = flat.std(axis=0)
    return {"method": "global_zscore", "mean": flat.mean(axis=0).tolist(),
            "std": np.where(std < 1e-6, 1.0, std).tolist()}


def normalize(windows: np.ndarray, norm: dict) -> np.ndarray:
    if norm.get("method") != "global_zscore":
        raise SchemaError(f"unsupported normalisation {norm.get('method')!r}")
    mean = np.asarray(norm["mean"], np.float32); std = np.asarray(norm["std"], np.float32)
    return ((windows - mean) / std).astype(np.float32)


# ── 5. whole-session convenience (what both training and inference call) ─────

@dataclass
class Prepared:
    windows: np.ndarray              # (W, L, F) raw features, un-normalised
    cleaned: CleanedFrames
    resampled: Resampled
    duration_s: float


def prepare_session(df: pd.DataFrame, cfg: PreprocessConfig = C.DEPLOYED) -> Prepared:
    cl = clean_frames(df, cfg)
    rs = resample(cl, cfg)
    feats = build_features(rs, cfg)
    wins = make_windows(feats, rs.hole, cfg)
    dur = float(cl.t[-1] - cl.t[0]) if cl.n_valid >= 2 else 0.0
    return Prepared(wins, cl, rs, dur)


def to_tensor(windows: np.ndarray, norm: dict):
    import torch
    return torch.from_numpy(normalize(windows, norm))
