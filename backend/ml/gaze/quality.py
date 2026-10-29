"""Recording quality metrics + gate.  Runs before any model call."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np

from . import config as C
from .preprocess import Prepared


@dataclass
class QualityReport:
    valid: bool
    reason: Optional[str]
    error_code: Optional[str]
    reasons: list = field(default_factory=list)
    sample_count: int = 0                 # frames returned by OpenFace
    valid_sample_count: int = 0
    valid_sample_ratio: float = 0.0
    mean_confidence: Optional[float] = None
    tracking_continuity: float = 0.0      # share of the session grid with real frames (no gaps)
    duration_seconds: float = 0.0
    window_count: int = 0
    data_quality_score: float = 0.0       # 0..1, documented formula below
    rejected: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def quality_score(valid_ratio: float, continuity: float, mean_conf: Optional[float]) -> float:
    """0.4*valid-frame ratio + 0.3*tracking continuity + 0.3*confidence mapped from [0.5, 1] to [0, 1]."""
    conf = 0.0 if mean_conf is None else min(1.0, max(0.0, (mean_conf - 0.5) / 0.5))
    return round(0.4 * valid_ratio + 0.3 * continuity + 0.3 * conf, 4)


def assess(prep: Prepared) -> QualityReport:
    cl, rs = prep.cleaned, prep.resampled
    n_total, n_valid = cl.n_total, cl.n_valid
    ratio = n_valid / n_total if n_total else 0.0
    cont = float(1.0 - rs.hole.mean()) if len(rs.hole) else 0.0
    mean_conf = float(np.mean(cl.confidence)) if n_valid else None
    rej = cl.rejected
    reasons: list[tuple[str, str]] = []     # (reason, error_code)

    if n_total == 0:
        reasons.append(("no_frames", C.ERR_TOO_FEW_FRAMES))
    else:
        if rej.get("no_face", 0) / n_total > 1 - C.MIN_VALID_FRAME_RATIO:
            reasons.append(("face_not_detected", C.ERR_NO_FACE))
        elif rej.get("low_confidence", 0) / n_total > 1 - C.MIN_VALID_FRAME_RATIO:
            reasons.append(("low_tracking_confidence", C.ERR_LOW_CONFIDENCE))
        elif ratio < C.MIN_VALID_FRAME_RATIO:
            reasons.append(("too_many_invalid_frames", C.ERR_QUALITY))
    if not reasons:
        if prep.duration_s < C.MIN_DURATION_S:
            reasons.append(("recording_too_short", C.ERR_TOO_FEW_FRAMES))
        elif prep.duration_s > C.MAX_SESSION_S:
            reasons.append(("recording_too_long", C.ERR_QUALITY))
        elif cont < C.MIN_TRACKING_CONTINUITY:
            reasons.append(("tracking_not_continuous", C.ERR_QUALITY))
        elif len(prep.windows) < C.MIN_WINDOWS:
            reasons.append(("too_few_usable_windows", C.ERR_TOO_FEW_FRAMES))

    warnings = []
    if not reasons:
        if ratio < 0.8:
            warnings.append("many_frames_rejected")
        if cont < 0.8:
            warnings.append("gaps_in_tracking")
    return QualityReport(
        valid=not reasons, reason=reasons[0][0] if reasons else None,
        error_code=reasons[0][1] if reasons else None, reasons=[r for r, _ in reasons],
        sample_count=n_total, valid_sample_count=n_valid, valid_sample_ratio=round(ratio, 4),
        mean_confidence=None if mean_conf is None else round(mean_conf, 4),
        tracking_continuity=round(cont, 4), duration_seconds=round(prep.duration_s, 2),
        window_count=int(len(prep.windows)),
        data_quality_score=quality_score(ratio, cont, mean_conf) if n_total else 0.0,
        rejected=dict(rej), warnings=warnings)


# ── domain applicability ─────────────────────────────────────────────────────

GATE_CHANNELS = {"gaze_angle_x": "gaze_angle_x", "gaze_angle_y": "gaze_angle_y",
                 "head_pose_x": "pose_Rx", "head_pose_y": "pose_Ry", "head_pose_z": "pose_Rz"}


def domain_stats(prep: Prepared, cfg: C.PreprocessConfig = C.DEPLOYED) -> dict:
    """Within-session std of the five gaze/head channels (valid grid steps only), keyed by feature name.
    The gate looks at head movement even for models that do not take it as input: it measures whether the
    recording context resembles the training recordings, not only the model's own inputs."""
    out = {}
    for name, col in GATE_CHANNELS.items():
        g = prep.resampled.grid.get(col)
        if g is None:
            continue
        v = g[np.isfinite(g)]
        if len(v) > 2:
            out[name] = float(np.std(v, ddof=1))
    return out


def domain_reference(stats_per_child: list) -> dict:
    """Robust location/scale of log-std per channel across DASD children (stored in the checkpoint)."""
    ref = {}
    for name in stats_per_child[0]:
        x = np.log(np.maximum([s[name] for s in stats_per_child], 1e-9))
        med = float(np.median(x)); sig = float(1.4826 * np.median(np.abs(x - med)))
        ref[name] = {"median_log_std": med, "sigma": max(sig, 1e-3),
                     "median_std": float(np.exp(med)), "min_std": float(np.exp(x.min())), "max_std": float(np.exp(x.max()))}
    return ref


def domain_check(stats: dict, reference: dict) -> dict:
    """in_domain | marginal | out_of_domain by the largest |z| over channels (see config.DOMAIN_Z_*)."""
    z = {}
    for name, r in reference.items():
        if name in stats:
            z[name] = round((np.log(max(stats[name], 1e-9)) - r["median_log_std"]) / r["sigma"], 2)
    worst = max((abs(v) for v in z.values()), default=float("inf"))
    status = "in_domain" if worst <= C.DOMAIN_Z_IN else "marginal" if worst <= C.DOMAIN_Z_OUT else "out_of_domain"
    direction = None
    if status != "in_domain" and z:
        k = max(z, key=lambda n: abs(z[n])); direction = "below" if z[k] < 0 else "above"
    return {"status": status, "max_abs_z": round(worst, 2), "z": z, "direction": direction,
            "session_std": {k: round(v, 4) for k, v in stats.items()},
            "dasd_median_std": {k: round(r["median_std"], 4) for k, r in reference.items()}}


# ── descriptive (non-diagnostic) recording summary ───────────────────────────

DESCRIPTIVE_DISCLAIMER = ("Descriptive measurements of this one recording (OpenFace gaze direction and head pose). "
                          "They are not diagnostic, are not compared with other children, and are not used in the combined result.")
_DESC_CHANNELS = (
    ("head_yaw", "Head turn (left-right)", "pose_Ry"), ("head_pitch", "Head nod (up-down)", "pose_Rx"),
    ("head_roll", "Head tilt", "pose_Rz"), ("gaze_x", "Gaze direction, horizontal", "gaze_angle_x"),
    ("gaze_y", "Gaze direction, vertical", "gaze_angle_y"))


def descriptive_summary(prep: Prepared) -> Optional[dict]:
    """Plain movement statistics in degrees from the cleaned frames, resampled on the model grid."""
    cl, rs = prep.cleaned, prep.resampled
    if cl.n_valid < 2 or not len(rs.hole):
        return None
    deg = 180.0 / np.pi
    chans = {}
    for key, label, col in _DESC_CHANNELS:
        if col not in rs.grid:
            continue
        x = rs.grid[col]; x = x[np.isfinite(x)] * deg
        if len(x) < 3:
            continue
        speed = np.abs(np.diff(x)) * rs.hz
        p5, p50, p95 = np.percentile(x, [5, 50, 95])
        chans[key] = {"label": label, "std_deg": round(float(x.std(ddof=1)), 2), "typical_range_deg": round(float(p95 - p5), 2),
                      "median_deg": round(float(p50), 2), "mean_speed_deg_per_s": round(float(speed.mean()), 2)}
    return {"channels": chans, "unit": "degrees", "disclaimer": DESCRIPTIVE_DISCLAIMER,
            "basis": f"{int(np.sum(np.isfinite(rs.grid['gaze_angle_x'])))} usable samples at {rs.hz} Hz"}
