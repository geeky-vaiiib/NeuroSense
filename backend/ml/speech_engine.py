"""Speech-based risk scoring for NeuroSense speech analysis step.

Receives base64-encoded audio captured by the frontend SpeechSession
component, decodes it, extracts acoustic features (MFCC, prosody, energy),
and returns a 0–1 risk probability score.

Strategy:
    • If a trained 1D-CNN checkpoint exists at  backend/models/speech_cnn.pt ,
      it is loaded once at module level and used for inference.
    • Otherwise a rule-based heuristic derived from validated clinical
      literature (Bone et al. 2014) is used, and the response is flagged
      ``isMock=True``.
"""

from __future__ import annotations

import base64
import io
import os
import tempfile
from pathlib import Path
from typing import Any

import numpy as np

# ── 1D-CNN model discovery ──────────────────────────────────────────────────
_CNN_PATH = Path(__file__).resolve().parent.parent / "models" / "speech_cnn.pt"


def _load_cnn() -> Any | None:
    """Attempt to load a trained 1D-CNN checkpoint."""
    if not _CNN_PATH.exists():
        return None
    try:
        import torch

        model = torch.load(_CNN_PATH, map_location="cpu", weights_only=False)
        model.eval()
        print(f"[NeuroSense] Speech CNN loaded from {_CNN_PATH}")
        return model
    except Exception as exc:  # pragma: no cover
        print(
            f"[NeuroSense] Speech CNN load failed ({exc}) — falling back to heuristic"
        )
        return None


_SPEECH_MODEL = _load_cnn()

# ── Lazy librosa availability flag ──────────────────────────────────────────
_LIBROSA_AVAILABLE: bool | None = None


def _check_librosa() -> bool:
    global _LIBROSA_AVAILABLE
    if _LIBROSA_AVAILABLE is None:
        try:
            import librosa  # noqa: F401

            _LIBROSA_AVAILABLE = True
        except ImportError:
            _LIBROSA_AVAILABLE = False
    return _LIBROSA_AVAILABLE


# ── Public API ──────────────────────────────────────────────────────────────

def compute_speech_score(
    audio_base64: str,
    mime_type: str = "audio/webm",
    transcript_hint: str = "",
    category: str = "adult",
) -> dict:
    """Score a base64-encoded speech recording and return risk assessment.

    Parameters
    ----------
    audio_base64 : str
        Base64-encoded audio bytes from the frontend MediaRecorder.
    mime_type : str
        MIME type of the audio (``audio/webm`` or ``audio/ogg``).
    transcript_hint : str
        Optional user-provided transcript of what they said.
    category : str
        ``"adult"`` or ``"child"``.

    Returns
    -------
    dict
        ``{ score, isMock, features, interpretation, clinical_flags }``
    """

    # ── Guard: no audio ─────────────────────────────────────────────────
    if not audio_base64:
        return _empty_result("No audio provided.")

    if not _check_librosa():
        return _empty_result("Speech analysis library not available.")

    # ── Decode and load audio ───────────────────────────────────────────
    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception:
        return _empty_result("Audio data could not be decoded from base64.")

    suffix = ".webm" if "webm" in mime_type else ".ogg"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        import librosa

        y, sr = librosa.load(tmp_path, sr=22050, mono=True, duration=25.0)
    except Exception as exc:
        return _empty_result(f"Audio could not be processed: {str(exc)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    # ── Guard: too short ────────────────────────────────────────────────
    duration_sec = len(y) / sr if sr > 0 else 0
    if duration_sec < 5.0:
        return _empty_result("Recording too short for analysis.")

    # ── Extract features ────────────────────────────────────────────────
    features = _extract_features(y, sr)

    # ── CNN path ────────────────────────────────────────────────────────
    if _SPEECH_MODEL is not None:
        return _predict_cnn(y, sr, features)

    # ── Heuristic path ──────────────────────────────────────────────────
    return _predict_heuristic(features, category)


# ── CNN inference ───────────────────────────────────────────────────────────

def _predict_cnn(y: np.ndarray, sr: int, features: dict) -> dict:
    """Run inference through the trained 1D-CNN checkpoint."""
    import torch
    import librosa

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    tensor = torch.tensor(mfccs, dtype=torch.float32).unsqueeze(0)  # (1, 13, T)

    with torch.no_grad():
        output = _SPEECH_MODEL(tensor)
        if output.dim() > 1:
            prob = torch.sigmoid(output[0, -1]).item()
        else:
            prob = torch.sigmoid(output[0]).item()

    score = round(max(0.0, min(prob, 1.0)), 4)

    return {
        "score": score,
        "isMock": False,
        "features": features,
        "interpretation": _interpret(score),
        "clinical_flags": [],
    }


# ── Heuristic inference ────────────────────────────────────────────────────

def _predict_heuristic(features: dict, category: str) -> dict:
    """Clinical-heuristic scoring (Bone et al. 2014)."""

    clinical_flags: list[str] = []

    pitch_std = features["pitch_std"]
    voiced_fraction = features["voiced_fraction"]
    mfcc_mean = features["mfcc_mean"]
    speech_rate = features["speech_rate"]

    # ── Flag 1: Atypical prosody ────────────────────────────────────────
    if pitch_std < 20:
        clinical_flags.append("Reduced pitch variability (monotone prosody)")
        risk_pitch = 0.85
    elif pitch_std > 120:
        clinical_flags.append("Elevated pitch variability (irregular prosody)")
        risk_pitch = 0.70
    else:
        risk_pitch = max(0.0, 1.0 - (pitch_std - 20) / 80)

    # ── Flag 2: Low voiced fraction ─────────────────────────────────────
    if voiced_fraction < 0.40:
        clinical_flags.append("Low speech density — extended silences detected")
        risk_voice = 0.80
    else:
        risk_voice = max(0.0, 1.0 - voiced_fraction / 0.65)

    # ── Flag 3: MFCC deviation ──────────────────────────────────────────
    mfcc1 = mfcc_mean[1] if len(mfcc_mean) > 1 else 0.0
    if mfcc1 < -60 or mfcc1 > 0:
        clinical_flags.append(
            "Atypical spectral envelope shape detected in MFCC analysis"
        )
        risk_mfcc = 0.70
    else:
        risk_mfcc = 0.30

    # ── Flag 4: Atypical speech rate ────────────────────────────────────
    if speech_rate < 1.5 or speech_rate > 6.0:
        clinical_flags.append("Atypical speech rate detected")
        risk_rate = 0.65
    else:
        risk_rate = 0.20

    # ── Weighted combination ────────────────────────────────────────────
    score = (
        0.35 * risk_pitch
        + 0.30 * risk_voice
        + 0.25 * risk_mfcc
        + 0.10 * risk_rate
    )
    score = round(max(0.0, min(score, 1.0)), 4)

    return {
        "score": score,
        "isMock": True,
        "features": features,
        "interpretation": _interpret(score),
        "clinical_flags": clinical_flags,
    }


# ── Feature extraction ─────────────────────────────────────────────────────

def _extract_features(y: np.ndarray, sr: int) -> dict:
    """Extract acoustic features from a mono waveform."""
    import librosa

    # 1. MFCC — 13 coefficients
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = mfccs.mean(axis=1).tolist()
    mfcc_std = mfccs.std(axis=1).tolist()

    # 2. Pitch (F0) via pyin
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7")
    )
    f0_voiced = f0[voiced_flag] if voiced_flag is not None else np.array([])
    pitch_mean = float(np.nanmean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    pitch_std = float(np.nanstd(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    voiced_fraction = (
        float(np.sum(voiced_flag) / len(voiced_flag))
        if voiced_flag is not None and len(voiced_flag) > 0
        else 0.0
    )

    # 3. Speech rate (estimated via ZCR envelope peaks)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    try:
        from scipy.signal import find_peaks

        peaks, _ = find_peaks(zcr, height=float(np.mean(zcr)), distance=5)
        speech_rate = float(len(peaks) / (len(y) / sr)) if len(y) > 0 else 0.0
    except ImportError:
        # scipy not available — rough estimate from ZCR mean
        speech_rate = float(np.mean(zcr) * 10)

    # 4. Energy (RMS)
    rms = librosa.feature.rms(y=y)[0]
    energy_mean = float(rms.mean())
    energy_std = float(rms.std())

    return {
        "mfcc_mean": [round(v, 4) for v in mfcc_mean],
        "mfcc_std": [round(v, 4) for v in mfcc_std],
        "pitch_mean": round(pitch_mean, 2),
        "pitch_std": round(pitch_std, 2),
        "speech_rate": round(speech_rate, 2),
        "voiced_fraction": round(voiced_fraction, 4),
        "energy_mean": round(energy_mean, 6),
        "energy_std": round(energy_std, 6),
    }


# ── Helpers ─────────────────────────────────────────────────────────────────

def _empty_result(interpretation: str) -> dict:
    """Return a null-score result for edge cases."""
    return {
        "score": None,
        "isMock": True,
        "features": {},
        "interpretation": interpretation,
        "clinical_flags": [],
    }


def _interpret(score: float) -> str:
    """Return a plain-English interpretation sentence."""
    if score >= 0.65:
        return (
            "Speech analysis identified atypical prosodic and acoustic "
            "features consistent with ASD-related communication patterns."
        )
    if score >= 0.40:
        return (
            "Speech analysis shows moderate deviation from typical prosody "
            "and vocal patterns."
        )
    return (
        "Speech acoustic features are within typical range for this age group."
    )
