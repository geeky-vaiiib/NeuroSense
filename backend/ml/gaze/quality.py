"""Session-level quality gate. Runs before any model call; returns machine-readable reasons."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np

from . import config as C
from .preprocess import CleanedSamples


@dataclass
class QualityReport:
    valid: bool
    reason: Optional[str]                       # first failing rule (None when valid)
    reasons: list[str] = field(default_factory=list)
    sample_count: int = 0                       # samples received
    valid_sample_count: int = 0
    valid_ratio: float = 0.0
    calibration_score: Optional[float] = None
    duration_s: float = 0.0
    sequence_steps: int = 0
    rejected: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def assess(
    cleaned: CleanedSamples,
    calibration: Optional[dict],
    n_steps: int,
) -> QualityReport:
    """Apply every documented rule; ``reason`` is the first failure in priority order."""
    reasons: list[str] = []
    n_total, n_valid = cleaned.n_total, cleaned.n_valid
    rej = cleaned.rejected

    cal_score = None
    if not calibration or not calibration.get("completed"):
        reasons.append("calibration_incomplete")
    else:
        cal_score = float(calibration.get("quality_score", 0.0))
        if cal_score < C.MIN_CALIBRATION_SCORE:
            reasons.append("poor_calibration")

    if n_total < C.MIN_TOTAL_SAMPLES:
        reasons.append("insufficient_samples")
    if n_total and rej.get("non_monotonic", 0) / n_total > C.MAX_NONMONOTONIC_RATIO:
        reasons.append("inconsistent_timestamps")
    seen_face = n_total - rej.get("non_finite", 0) - rej.get("negative_timestamp", 0) - rej.get("non_monotonic", 0)
    if seen_face > 0 and rej.get("face_not_detected", 0) / seen_face > (1 - C.MIN_FACE_RATIO):
        reasons.append("face_not_detected")
    if n_valid < C.MIN_VALID_SAMPLES or (n_total and n_valid / n_total < C.MIN_VALID_RATIO):
        if "face_not_detected" not in reasons:
            reasons.append("insufficient_valid_samples")

    duration_s = float((cleaned.t_ms[-1] - cleaned.t_ms[0]) / 1000.0) if n_valid >= 2 else 0.0
    if duration_s > C.MAX_SESSION_S:
        reasons.append("session_too_long")
    if n_steps < C.MIN_SEQ_STEPS:
        reasons.append("insufficient_usable_duration")

    return QualityReport(
        valid=not reasons,
        reason=reasons[0] if reasons else None,
        reasons=reasons,
        sample_count=n_total,
        valid_sample_count=n_valid,
        valid_ratio=round(n_valid / n_total, 4) if n_total else 0.0,
        calibration_score=cal_score,
        duration_s=round(duration_s, 2),
        sequence_steps=int(n_steps),
        rejected=dict(rej),
    )
