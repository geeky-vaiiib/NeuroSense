"""Acoustic feature extraction for speech recordings (measurement only - NOT a classifier).

MFCC, pitch, energy and speech-rate statistics are *measurements*.  They become a screening signal only when a
classifier trained on participant-labelled ASD / typical speech data is attached (see
backend/data/train_speech_asd.py); until then speech classification is reported as unavailable.
The same ``extract_features`` + ``feature_vector`` pair must be used for training and inference.
"""

from __future__ import annotations

import numpy as np

SAMPLE_RATE = 22050
MIN_DURATION_S = 5.0
MAX_DURATION_S = 25.0
N_MFCC = 13

# Order of the numeric vector fed to a classifier (training and inference share this).
VECTOR_NAMES = (
    [f"mfcc{i}_mean" for i in range(N_MFCC)] + [f"mfcc{i}_std" for i in range(N_MFCC)]
    + ["pitch_mean", "pitch_std", "speech_rate", "voiced_fraction", "energy_mean", "energy_std"]
)


def extract_features(y: np.ndarray, sr: int) -> dict:
    """Mono waveform -> descriptive acoustic features."""
    import librosa

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
    f0, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"))
    f0_voiced = f0[voiced_flag] if voiced_flag is not None else np.array([])
    pitch_mean = float(np.nanmean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    pitch_std = float(np.nanstd(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    voiced_fraction = float(np.sum(voiced_flag) / len(voiced_flag)) if voiced_flag is not None and len(voiced_flag) > 0 else 0.0
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    try:
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(zcr, height=float(np.mean(zcr)), distance=5)
        speech_rate = float(len(peaks) / (len(y) / sr)) if len(y) > 0 else 0.0
    except ImportError:  # pragma: no cover
        speech_rate = float(np.mean(zcr) * 10)
    rms = librosa.feature.rms(y=y)[0]
    return {
        "mfcc_mean": [round(float(v), 4) for v in mfccs.mean(axis=1)],
        "mfcc_std": [round(float(v), 4) for v in mfccs.std(axis=1)],
        "pitch_mean": round(pitch_mean, 2), "pitch_std": round(pitch_std, 2),
        "speech_rate": round(speech_rate, 2), "voiced_fraction": round(voiced_fraction, 4),
        "energy_mean": round(float(rms.mean()), 6), "energy_std": round(float(rms.std()), 6),
    }


def feature_vector(features: dict) -> np.ndarray:
    """Descriptive feature dict -> classifier input in VECTOR_NAMES order."""
    return np.array(list(features["mfcc_mean"]) + list(features["mfcc_std"]) + [
        features["pitch_mean"], features["pitch_std"], features["speech_rate"],
        features["voiced_fraction"], features["energy_mean"], features["energy_std"]], dtype=np.float64)
