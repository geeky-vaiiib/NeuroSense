"""Centralized modality-status contract (the only place that decides what a modality's state is).

A modality's *status* says what we know about its output; its *eligibility* says whether the output may
influence the screening result.  They are separate: a modality can produce a number (``available_experimental``)
and still be ineligible.  Unavailable modalities have ``output = None`` - never 0.

Statuses
  available_validated            validated for the intended use          (nothing in this repository qualifies)
  available_scoring_instrument   transparent questionnaire scoring rule  (eligible)
  available_experimental         produced an output, not validated       (never eligible)
  insufficient_data              not enough input to analyse
  failed_quality                 input failed a quality / applicability check
  model_unavailable              no (validated) model is installed
  analysis_failed                processing error
  skipped | not_provided         the user skipped it / nothing was submitted
"""

from __future__ import annotations

from typing import Optional

AVAILABLE_VALIDATED = "available_validated"
AVAILABLE_SCORING = "available_scoring_instrument"
AVAILABLE_EXPERIMENTAL = "available_experimental"
INSUFFICIENT_DATA = "insufficient_data"
FAILED_QUALITY = "failed_quality"
MODEL_UNAVAILABLE = "model_unavailable"
ANALYSIS_FAILED = "analysis_failed"
SKIPPED = "skipped"
NOT_PROVIDED = "not_provided"

STATUS_LABELS = {
    AVAILABLE_VALIDATED: "Available · validated", AVAILABLE_SCORING: "Scoring rule · used",
    AVAILABLE_EXPERIMENTAL: "Experimental · not used in result", INSUFFICIENT_DATA: "Insufficient data",
    FAILED_QUALITY: "Failed quality check", MODEL_UNAVAILABLE: "No validated model",
    ANALYSIS_FAILED: "Analysis failed", SKIPPED: "Skipped", NOT_PROVIDED: "Not provided",
}
# Which statuses can ever feed the result, and which modality ids are allowed to (explicit allow-list).
ELIGIBLE_STATUSES = frozenset({AVAILABLE_VALIDATED, AVAILABLE_SCORING})
ELIGIBLE_MODALITIES = frozenset({"questionnaire"})


def _state(mid: str, label: str, status: str, **kw) -> dict:
    s = {"id": mid, "label": label, "status": status, "status_label": STATUS_LABELS[status],
         "reason": None, "error_code": None, "model": None, "output": None, "measurements": None, "quality": None,
         "detail": ""}
    s.update(kw)
    s["eligible_for_result"] = bool(mid in ELIGIBLE_MODALITIES and status in ELIGIBLE_STATUSES)
    s["in_result"] = s["eligible_for_result"]
    return s


def questionnaire_state(screening: dict, model_output: Optional[dict]) -> dict:
    return _state(
        "questionnaire", "Questionnaire score", AVAILABLE_SCORING,
        output={"kind": "screening_score", "total": screening["total_score"], "max": screening["max_score"],
                "threshold": screening["threshold"], "meets_threshold": screening["meets_threshold"]},
        model=None if model_output is None else {"kind": ("toddler_polish_cohort_model" if screening.get("category") == "toddler" else "ml_reproducing_score_rule"),
                                                 "version": model_output.get("model_used") or model_output.get("model_version"),
                                                 "validated": False, "role": "explanation only - does not affect the result"},
        detail=("Server-computed total of ten items against the threshold used to label the training data. "
                "The ML model that reproduces this rule is shown separately and does not affect the result."))


def gaze_state(gaze: Optional[dict], skipped: bool, skip_reason: Optional[str]) -> dict:
    label = "Eye gaze (OpenFace, experimental)"
    if skipped or not gaze:
        return _state("gaze", label, SKIPPED if skipped else NOT_PROVIDED, reason=skip_reason if skipped else None)
    st = gaze.get("status")
    model = {"version": gaze.get("model_version"), "dataset": gaze.get("dataset"), "validated": False}
    common = dict(error_code=gaze.get("error_code"), quality=gaze.get("quality"), model=model,
                  measurements={"descriptive": gaze.get("descriptive"), "domain": gaze.get("domain")})
    if st == "success":
        return _state("gaze", label, AVAILABLE_EXPERIMENTAL, output={"kind": "experimental_classifier_output", "value": gaze.get("probability"),
                      "meaning": "BiLSTM trained on DASD (82 children); not shown to beat recording-context controls; not validated on webcam data"},
                      reason="Excluded from the result: no webcam / labelled deployment validation.", **common)
    if st in ("insufficient_quality", "out_of_domain"):
        return _state("gaze", label, FAILED_QUALITY, reason=gaze.get("reason"), **common)
    code = gaze.get("error_code") or ""
    if code in ("GAZE_MODEL_MISSING", "GAZE_MODEL_SCHEMA_MISMATCH"):
        return _state("gaze", label, MODEL_UNAVAILABLE, reason=gaze.get("reason"), **common)
    return _state("gaze", label, ANALYSIS_FAILED, reason=gaze.get("reason") or gaze.get("detail"), **common)


def speech_state(speech: Optional[dict], skipped: bool) -> dict:
    label = "Speech"
    if skipped or not speech:
        return _state("speech", label, SKIPPED if skipped else NOT_PROVIDED)
    st = speech.get("status")
    common = dict(reason=speech.get("reason"), error_code=speech.get("error_code"), quality=speech.get("quality"),
                  measurements=speech.get("features") or None)
    if st == "available_experimental":
        return _state("speech", label, AVAILABLE_EXPERIMENTAL, model=speech.get("model"),
                      output={"kind": "experimental_classifier_output", "value": speech.get("output")}, **common)
    status = st if st in (INSUFFICIENT_DATA, FAILED_QUALITY, MODEL_UNAVAILABLE, ANALYSIS_FAILED) else ANALYSIS_FAILED
    return _state("speech", label, status, **common)


def facial_state(facial: Optional[dict], skipped: bool) -> dict:
    label = "Facial (face detection only)"
    if skipped or not facial:
        return _state("facial", label, SKIPPED if skipped else NOT_PROVIDED)
    st = facial.get("status")
    status = st if st in (INSUFFICIENT_DATA, FAILED_QUALITY, MODEL_UNAVAILABLE, ANALYSIS_FAILED) else ANALYSIS_FAILED
    return _state("facial", label, status, reason=facial.get("reason"), error_code=facial.get("error_code"),
                  measurements=facial.get("features") or None)
