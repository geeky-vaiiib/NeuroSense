"""
ml/preprocessing_pipeline.py — Unified preprocessing entry-point for NeuroSense.

Structural aggregation layer: dispatches to the per-modality preprocessing
functions that already exist in their respective engine modules, and returns
a single ``PreprocessedInput`` dataclass that the router can pass straight
into fusion_engine.fuse().

Design rules:
  - NO behaviour change.  Every computation is delegated to the existing
    per-modality functions; this module contains zero new ML logic.
  - All per-modality results are stored in their original dict form so the
    router can pluck whichever fields it needs unchanged.
  - The questionnaire ML prediction (predict()) is NOT triggered here; it
    belongs in the router after model-registry look-up.  This module only
    handles the raw-input → modality-feature stage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── Per-modality engine imports ──────────────────────────────────────────────
# Each import is guarded to mirror the router's own try/except pattern so
# this module works whether executed with the backend/ as cwd (pytest) or
# as a sub-package (uvicorn).

try:
    from ..ml.gaze_engine import compute_gaze_score
    from ..ml.speech_engine import compute_speech_score
    from ..ml.facial_engine import compute_facial_score
    from ..ml.preprocessor import preprocess_for_inference
except ImportError:
    from ml.gaze_engine import compute_gaze_score
    from ml.speech_engine import compute_speech_score
    from ml.facial_engine import compute_facial_score
    from ml.preprocessor import preprocess_for_inference


# ── Result container ─────────────────────────────────────────────────────────

@dataclass
class PreprocessedInput:
    """Aggregated result of the preprocessing stage for one screening request.

    Attributes
    ----------
    category : str
        Screening category: ``"adult"``, ``"child"``, or ``"toddler"``.
    tabular_features : numpy.ndarray
        Shape ``(1, 15)`` feature vector ready for the questionnaire ML model.
    gaze_result : dict | None
        Raw output of ``gaze_engine.compute_gaze_score()``.
        ``None`` when the gaze step was skipped or had no data.
    speech_result : dict | None
        Raw output of ``speech_engine.compute_speech_score()``.
        ``None`` when the speech step was skipped or errored.
    facial_result : dict | None
        Raw output of ``facial_engine.compute_facial_score()``.
        ``None`` when the facial step was skipped or errored.
    modality_errors : dict[str, str]
        Per-modality error messages collected during dispatch (if any).
    """
    category: str
    tabular_features: object        # numpy.ndarray — typed as object to avoid top-level numpy import
    gaze_result: Optional[dict] = None
    speech_result: Optional[dict] = None
    facial_result: Optional[dict] = None
    modality_errors: dict = field(default_factory=dict)


# ── Public entry-point ───────────────────────────────────────────────────────

def preprocess_screening_input(
    category: str,
    demo: dict,
    answers: dict,
    encoders: Optional[dict] = None,
    *,
    gaze_points: Optional[list[dict]] = None,
    gaze_skipped: bool = False,
    audio_base64: Optional[str] = None,
    audio_mime_type: str = "audio/webm",
    transcript_hint: str = "",
    speech_skipped: bool = False,
    facial_image_base64: Optional[str] = None,
    facial_skipped: bool = False,
) -> PreprocessedInput:
    """Dispatch raw screening inputs to all per-modality preprocessing functions.

    Parameters
    ----------
    category : str
        ``"adult"``, ``"child"``, or ``"toddler"``.
    demo : dict
        Demographics dict (age, gender, jaundice, familyAsd, ethnicity, …).
    answers : dict
        AQ-10 / Q-CHAT-10 raw answer strings keyed by ``"A1"``–``"A10"``.
    encoders : dict | None
        Fitted sklearn LabelEncoders from the model bundle (for ethnicity).
    gaze_points : list[dict] | None
        Raw gaze-point dicts from the frontend.
    gaze_skipped : bool
        True when the user deliberately skipped the gaze step.
    audio_base64 : str | None
        Base64-encoded audio recording.
    audio_mime_type : str
        MIME type of the audio (e.g. ``"audio/webm"``).
    transcript_hint : str
        Optional transcript hint for the speech engine.
    speech_skipped : bool
        True when the user deliberately skipped the speech step.
    facial_image_base64 : str | None
        Base64-encoded facial image.
    facial_skipped : bool
        True when the user deliberately skipped the facial step.

    Returns
    -------
    PreprocessedInput
        Aggregated preprocessing result ready for fusion_engine.fuse().
    """
    errors: dict[str, str] = {}

    # ── 1. Tabular features (questionnaire) ───────────────────────────────────
    tabular_features = preprocess_for_inference(
        demo=demo,
        answers=answers,
        encoders=encoders,
        category=category,
    )

    # ── 2. Gaze ───────────────────────────────────────────────────────────────
    gaze_result: Optional[dict] = None
    if not gaze_skipped:
        points = gaze_points or []
        if len(points) >= 20:
            gaze_result = compute_gaze_score(points, category=category)
        elif points:
            # Attempted but insufficient — compute_gaze_score handles empty list
            gaze_result = compute_gaze_score([], category=category)
        # If len(points) == 0 and not skipped: leave as None (not submitted)

    # ── 3. Speech ─────────────────────────────────────────────────────────────
    speech_result: Optional[dict] = None
    if audio_base64 and not speech_skipped:
        try:
            speech_result = compute_speech_score(
                audio_base64=audio_base64,
                mime_type=audio_mime_type,
                transcript_hint=transcript_hint,
                category=category,
            )
        except Exception as exc:
            errors["speech"] = str(exc)
            speech_result = _speech_error_result(str(exc))

    # ── 4. Facial ─────────────────────────────────────────────────────────────
    facial_result: Optional[dict] = None
    if facial_image_base64 and not facial_skipped:
        try:
            facial_result = compute_facial_score(
                image_base64=facial_image_base64,
                category=category,
            )
        except Exception as exc:
            errors["facial"] = str(exc)
            facial_result = _facial_error_result(str(exc))

    return PreprocessedInput(
        category=category,
        tabular_features=tabular_features,
        gaze_result=gaze_result,
        speech_result=speech_result,
        facial_result=facial_result,
        modality_errors=errors,
    )


# ── Error-result helpers (mirror the router's inline dicts) ──────────────────

def _speech_error_result(detail: str) -> dict:
    return {
        "available": False,
        "trained_model": False,
        "probability": None,
        "status": "error",
        "score": None,
        "isMock": True,
        "is_trained_model": False,
        "method": "rule_based_heuristic",
        "modality_label": "Speech Analysis (Research Heuristic — Bone et al. 2014)",
        "features": {},
        "interpretation": f"Speech processing error: {detail}",
        "clinical_flags": [],
    }


def _facial_error_result(detail: str) -> dict:
    return {
        "score": None,
        "isMock": True,
        "is_trained_model": False,
        "method": "rule_based_heuristic",
        "modality_label": "Facial Analysis (Research Heuristic)",
        "features": {},
        "interpretation": f"Facial processing error: {detail}",
    }
