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
