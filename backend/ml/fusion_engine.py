"""Screening-result contract (the single backend source of truth; the frontend never computes a result).

FORMULA
  The screening result is the questionnaire's threshold-based score and nothing else:
      outcome   = total_score >= threshold            (threshold: questionnaire_score.LABEL_RULE_THRESHOLD)
      band      = High if total >= threshold; Moderate if total == threshold - 1; else Low
  There is NO composite probability and NO modality weights.  ``composite_probability`` is always null.

ELIGIBILITY
  A modality may influence the result only if its id is in modality_status.ELIGIBLE_MODALITIES AND its status is
  in ELIGIBLE_STATUSES.  Today that is the questionnaire scoring instrument only.  Gaze (experimental BiLSTM),
  speech (no classifier) and facial (detection only) are listed under ``excluded`` with their status and reason.

MISSING / UNAVAILABLE MODALITIES
  They are reported with their status and ``output = null``; they are never scored as 0 and never imputed, so
  they cannot change the result.  Adding a second eligible modality requires (a) validation evidence and (b) a
  combination rule that is itself justified - ``combine`` refuses to guess one.
"""

from __future__ import annotations

try:
    from .modality_status import ELIGIBLE_MODALITIES, ELIGIBLE_STATUSES
except ImportError:  # pragma: no cover
    from ml.modality_status import ELIGIBLE_MODALITIES, ELIGIBLE_STATUSES

FORMULA = ("result = questionnaire total score vs threshold; risk band = High (total >= threshold) / Moderate "
           "(total = threshold - 1) / Low; no composite probability, no modality weights")


class FusionError(RuntimeError):
    pass


def combine(screening: dict, states: list[dict]) -> dict:
    """screening: questionnaire_score.score_questionnaire() output (server computed); states: modality states.
    Only the eligible modalities are used; everything else is listed as excluded."""
    eligible = [s for s in states if s["id"] in ELIGIBLE_MODALITIES and s["status"] in ELIGIBLE_STATUSES]
    ids = [s["id"] for s in eligible]
    if ids != ["questionnaire"]:
        if "questionnaire" not in ids:
            raise FusionError("the questionnaire state is missing; no screening result can be produced")
        raise FusionError(f"no combination rule is defined for several eligible modalities: {ids}")
    excluded = [{"id": s["id"], "status": s["status"], "status_label": s["status_label"], "reason": s.get("reason")}
                for s in states if s not in eligible]
    for s in states:                             # make the in/out decision explicit on every state
        s["in_result"] = s in eligible
    return {
        "basis": "questionnaire_score_only", "formula": FORMULA,
        "risk_level": screening["risk_band"], "outcome": "at_or_above_threshold" if screening["meets_threshold"] else "below_threshold",
        "total_score": screening["total_score"], "max_score": screening["max_score"], "threshold": screening["threshold"],
        "composite_probability": None, "weights": None,
        "modalities_in_result": ids, "excluded": excluded,
        "note": ("Screening aid, not a diagnosis. Experimental or unavailable modalities do not change this result."),
    }
