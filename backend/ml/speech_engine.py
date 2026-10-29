"""Speech analysis for NeuroSense: genuine acoustic measurement, no unvalidated classification.

What is implemented
  * decoding of the recorded audio and acoustic feature extraction (MFCC, pitch, energy, rate) - measurements;
  * an optional ASD classifier loader that accepts ONLY a safe, non-pickle checkpoint
    (backend/models/speech_asd_model.json) produced by backend/data/train_speech_asd.py from participant-labelled data.

What is NOT implemented
  * No speech ASD classifier exists in this repository, so classification is reported as ``model_unavailable``.
    The former synthetic-proxy CNN (``models/speech_cnn.pt``, trained on planted statistics, unsafe pickle) is
    quarantined: it is never loaded, and the former rule-based "clinical flag" heuristic was removed because it
    had no validation and produced clinical-sounding output.
  * Even a loaded classifier is never a fusion input until the fusion contract is changed after validation.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
from pathlib import Path

import numpy as np

try:
    from . import speech_features as SF
except ImportError:  # pragma: no cover - backend/ as cwd
    from ml import speech_features as SF

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CLASSIFIER_PATH = MODELS_DIR / "speech_asd_model.json"          # safe JSON checkpoint (no pickle)
QUARANTINED = MODELS_DIR / "speech_cnn.pt"                      # synthetic proxy: documented, never loaded

ERR_NO_AUDIO = "SPEECH_NO_AUDIO"
ERR_DECODE = "SPEECH_DECODE_FAILED"
ERR_TOO_SHORT = "SPEECH_TOO_SHORT"
ERR_LIBRARY = "SPEECH_LIBRARY_UNAVAILABLE"
ERR_NO_MODEL = "SPEECH_CLASSIFIER_UNAVAILABLE"

_LIBROSA: bool | None = None


def _librosa_ok() -> bool:
    global _LIBROSA
    if _LIBROSA is None:
        try:
            import librosa  # noqa: F401
            _LIBROSA = True
        except ImportError:
            _LIBROSA = False
    return _LIBROSA


def load_classifier(path: Path = CLASSIFIER_PATH):
    """-> (coef, intercept, mean, scale, metadata) from a JSON checkpoint, or (None, reason).  Never unpickles."""
    if not Path(path).exists():
        return None, "no speech classifier checkpoint (speech_asd_model.json) is installed"
    try:
        d = json.loads(Path(path).read_text())
        meta = d["metadata"]
        if meta.get("is_synthetic_proxy") or not meta.get("participant_level_split") or meta.get("feature_names") != SF.VECTOR_NAMES:
            return None, "checkpoint metadata is not an acceptable participant-labelled ASD speech model"
        coef, mean, scale = (np.asarray(d[k], float) for k in ("coef", "mean", "scale"))
        if not (len(coef) == len(mean) == len(scale) == len(SF.VECTOR_NAMES)):
            return None, "checkpoint dimensions do not match the feature contract"
        return (coef, float(d["intercept"]), mean, scale, meta), None
    except Exception as exc:
        return None, f"checkpoint could not be read: {exc}"


def _result(status: str, *, reason: str | None = None, code: str | None = None, features: dict | None = None,
            duration_s: float | None = None, output: float | None = None, model: dict | None = None) -> dict:
    return {"modality": "speech", "status": status, "reason": reason, "error_code": code, "features": features or {},
            "quality": {"duration_seconds": None if duration_s is None else round(duration_s, 2)},
            "output": output, "model": model,
            "interpretation": ("Acoustic measurements were extracted from the recording. No validated speech classifier is "
                               "installed, so no speech screening result is produced.") if status == "model_unavailable" else (reason or "")}


def analyze_speech(audio_base64: str, mime_type: str = "audio/webm") -> dict:
    """Decode + measure.  Returns a status dict (see modality_status.speech_state); never invents a score."""
    if not audio_base64:
        return _result("insufficient_data", reason="No audio provided.", code=ERR_NO_AUDIO)
    if not _librosa_ok():
        return _result("analysis_failed", reason="Speech analysis library is not available on the server.", code=ERR_LIBRARY)
    try:
        audio_bytes = base64.b64decode(audio_base64, validate=True)
    except Exception:
        return _result("analysis_failed", reason="Audio data could not be decoded from base64.", code=ERR_DECODE)
    suffix = ".webm" if "webm" in mime_type else ".wav" if "wav" in mime_type else ".ogg"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        import librosa
        y, sr = librosa.load(tmp_path, sr=SF.SAMPLE_RATE, mono=True, duration=SF.MAX_DURATION_S)
    except Exception as exc:
        return _result("analysis_failed", reason=f"Audio could not be processed: {exc}", code=ERR_DECODE)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)           # recordings are never kept
    duration = len(y) / sr if sr > 0 else 0.0
    if duration < SF.MIN_DURATION_S:
        return _result("insufficient_data", reason="Recording too short for analysis.", code=ERR_TOO_SHORT, duration_s=duration)
    features = SF.extract_features(y, sr)
    clf, why = load_classifier()
    if clf is None:
        return _result("model_unavailable", reason=why, code=ERR_NO_MODEL, features=features, duration_s=duration)
    coef, intercept, mean, scale, meta = clf
    z = (SF.feature_vector(features) - mean) / np.where(scale == 0, 1.0, scale)
    p = float(1.0 / (1.0 + np.exp(-(z @ coef + intercept))))
    return _result("available_experimental", features=features, duration_s=duration, output=round(p, 4),
                   model={"version": meta.get("model_version"), "dataset": meta.get("dataset"), "validated": bool(meta.get("validated_for_deployment", False))})
