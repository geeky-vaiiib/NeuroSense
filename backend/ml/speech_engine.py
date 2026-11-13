"""Speech analysis for NeuroSense: genuine acoustic measurement, no unvalidated classification.

What is implemented
  * decoding of the recorded audio and acoustic feature extraction (MFCC, pitch, energy, rate) - measurements;
  * a separate optional adult research speech-emotion CNN, never used as an ASD classifier;
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
import subprocess
import io
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


def analyze_speech(audio_base64: str, mime_type: str = "audio/webm", *, research_enabled: bool = False) -> dict:
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
        # Decode browser containers explicitly; do not depend on audioread's
        # deprecated stdlib imports or extension guessing for WebM/MP4.
        decoded = subprocess.run(['ffmpeg','-v','error','-i',tmp_path,'-t',str(SF.MAX_DURATION_S),
                                  '-ac','1','-f','wav','-acodec','pcm_f32le','pipe:1'],
                                 capture_output=True,check=True,timeout=40)
        import soundfile as sf
        native_y, native_sr = sf.read(io.BytesIO(decoded.stdout),dtype='float32')
        sr = SF.SAMPLE_RATE
        y = librosa.resample(native_y, orig_sr=native_sr, target_sr=sr) if native_sr != sr else native_y
    except Exception:
        import logging
        logging.getLogger('neurosense.speech').exception('Audio decoding failed')
        return _result("analysis_failed", reason="The server could not decode the recording. Check the server audio runtime and FFmpeg installation before trying again.", code=ERR_DECODE)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)           # recordings are never kept
    duration = len(y) / sr if sr > 0 else 0.0
    if duration < SF.MIN_DURATION_S:
        return _result("insufficient_data", reason="Recording too short for analysis.", code=ERR_TOO_SHORT, duration_s=duration)
    try:
        features = SF.extract_features(y, sr)
    except Exception:
        import logging
        logging.getLogger("neurosense.speech").exception("Acoustic measurement failed")
        return _result("analysis_failed", reason="Acoustic measurement failed; see server logs.", code=ERR_DECODE, duration_s=duration)
    features['spectral_flatness_median'] = float(np.median(librosa.feature.spectral_flatness(y=y)))
    features['clipped_sample_fraction'] = float(np.mean(np.abs(y) >= 0.999))
    features['input_quality_policy'] = 'speech-input-hygiene-v1; flatness <0.5 and >=0.5s pYIN voiced-frame evidence; not a speech detector'
    features['speech_presence_method'] = 'pYIN voiced-frame evidence; not a speech/non-speech classifier. Tones can appear voiced.'
    emotion_result = None
    if research_enabled:
        from .research_inference import speech_emotion
        if float(np.max(np.abs(y))) < 1e-5:
            from .research_inference import unavailable
            emotion_result = unavailable('speech', 'The recording is silent. Measurements are retained; check the microphone and record audible speech.', 'failed_quality')
        elif features['spectral_flatness_median'] >= 0.5:
            from .research_inference import unavailable
            emotion_result = unavailable('speech', 'The recording is predominantly noise-like under the spectral-flatness input check. Measurements are retained; record audible speech in a quiet room.', 'failed_quality')
        elif features.get('voiced_fraction', 0) * duration < 0.5:
            from .research_inference import unavailable
            emotion_result = unavailable('speech', 'Less than half a second of voiced-frame evidence was found by the pitch estimator. Acoustic measurements are retained; record clear audible speech for emotion analysis.', 'failed_quality')
        else:
            emotion_result = speech_emotion(native_y, native_sr)
    clf, why = load_classifier()
    if clf is None:
        result = _result("model_unavailable", reason=why, code=ERR_NO_MODEL, features=features, duration_s=duration)
        if emotion_result is not None:
            result['emotion_result'] = emotion_result
        return result
    coef, intercept, mean, scale, meta = clf
    z = (SF.feature_vector(features) - mean) / np.where(scale == 0, 1.0, scale)
    p = float(1.0 / (1.0 + np.exp(-(z @ coef + intercept))))
    result = _result("available_experimental", features=features, duration_s=duration, output=round(p, 4),
                     model={"version": meta.get("model_version"), "dataset": meta.get("dataset"), "validated": bool(meta.get("validated_for_deployment", False))})
    if emotion_result is not None:
        result['emotion_result'] = emotion_result
    return result
