"""ml/preprocessing_pipeline.py - turn the raw screening request into per-modality analysis results.

Gaze is analysed earlier by /gaze/analyze (the server looks up its own result by id); speech and facial are
measured here.  Nothing in this module produces a risk score: classifiers that do not exist are reported as
unavailable, and exceptions become explicit ``analysis_failed`` results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

try:
    from .facial_engine import analyze_face
    from .speech_engine import analyze_speech
except ImportError:  # pragma: no cover - backend/ as cwd
    from ml.facial_engine import analyze_face
    from ml.speech_engine import analyze_speech


@dataclass
class PreprocessedInput:
    category: str
    gaze_result: Optional[dict] = None
    speech_result: Optional[dict] = None
    facial_result: Optional[dict] = None
    modality_errors: dict = field(default_factory=dict)


def preprocess_screening_input(
    category: str,
    *,
    gaze_result: Optional[dict] = None,
    gaze_skipped: bool = False,
    audio_base64: Optional[str] = None,
    audio_mime_type: str = "audio/webm",
    speech_skipped: bool = False,
    facial_image_base64: Optional[str] = None,
    facial_skipped: bool = False,
) -> PreprocessedInput:
    errors: dict[str, str] = {}
    speech_result = facial_result = None
    if audio_base64 and not speech_skipped:
        try:
            speech_result = analyze_speech(audio_base64, audio_mime_type)
        except Exception as exc:
            errors["speech"] = str(exc)
            speech_result = {"modality": "speech", "status": "analysis_failed", "reason": f"Speech processing error: {exc}",
                             "error_code": "SPEECH_INTERNAL", "features": {}, "output": None, "model": None}
    if facial_image_base64 and not facial_skipped:
        try:
            facial_result = analyze_face(facial_image_base64)
        except Exception as exc:
            errors["facial"] = str(exc)
            facial_result = {"modality": "facial", "status": "analysis_failed", "reason": f"Facial processing error: {exc}",
                             "error_code": "FACIAL_INTERNAL", "features": {}, "output": None, "model": None}
    return PreprocessedInput(category=category, gaze_result=None if gaze_skipped else gaze_result,
                             speech_result=speech_result, facial_result=facial_result, modality_errors=errors)
