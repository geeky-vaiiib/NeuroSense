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
    duration_ms: int = 0
    sequence_steps: int = 0
    rejected: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)      # non-fatal
    sampling_rate_hz: Optional[float] = None               # valid samples / duration
    tracking_continuity: Optional[float] = None            # 1 - (time inside gaps > MAX_GAP_MS) / duration

    def to_dict(self) -> dict:
        return asdict(self)


def assess(
    cleaned: CleanedSamples,
    calibration: Optional[dict],
    n_steps: int,
    fixation_ratio: Optional[float] = None,
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

    # ── non-fatal warnings: reported, never block inference ──
    warnings: list[str] = []
    if not reasons:
        if cal_score is not None and cal_score < C.WARN_CALIBRATION_SCORE:
            warnings.append("marginal_calibration")
        if n_total and n_valid / n_total < C.WARN_VALID_RATIO:
            warnings.append("many_unusable_samples")
        if n_valid >= 2:
            gaps = np.diff(cleaned.t_ms)
            gap_time = float(gaps[gaps > C.MAX_GAP_MS].sum())
            if duration_s > 0 and gap_time / (duration_s * 1000.0) > C.WARN_GAP_RATIO:
                warnings.append("gaps_in_session")
        if fixation_ratio is not None and fixation_ratio < C.WARN_MIN_FIXATION_RATIO:
            warnings.append("very_few_fixations")

    rate = continuity = None
    if n_valid >= 2 and duration_s > 0:
        gaps = np.diff(cleaned.t_ms)
        rate = round((n_valid - 1) / duration_s, 2)
        continuity = round(max(0.0, 1.0 - float(gaps[gaps > C.MAX_GAP_MS].sum()) / (duration_s * 1000.0)), 4)

    return QualityReport(
        valid=not reasons,
        reason=reasons[0] if reasons else None,
        reasons=reasons,
        sample_count=n_total,
        valid_sample_count=n_valid,
        valid_ratio=round(n_valid / n_total, 4) if n_total else 0.0,
        calibration_score=cal_score,
        duration_s=round(duration_s, 2),
        duration_ms=int(round(duration_s * 1000)),
        sequence_steps=int(n_steps),
        rejected=dict(rej),
        warnings=warnings,
        sampling_rate_hz=rate,
        tracking_continuity=continuity,
    )
