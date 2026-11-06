"""Speech and facial: genuine measurement only; classification is unavailable unless a safe, valid model exists."""

import base64
import json
import wave
from pathlib import Path

import numpy as np
import pytest

from backend.ml import facial_engine as FE
from backend.ml import speech_engine as SE
from backend.ml import speech_features as SF


def _wav_b64(seconds=6.0, sr=22050, freq=180.0):
    t = np.arange(int(seconds * sr)) / sr
    y = (0.3 * np.sin(2 * np.pi * freq * t) * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))).astype(np.float32)
    import io
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((y * 32767).astype("<i2").tobytes())
    return base64.b64encode(buf.getvalue()).decode()


def test_no_audio_and_corrupt_audio_are_explicit_not_scores():
    r = SE.analyze_speech("")
    assert r["status"] == "insufficient_data" and r["output"] is None and r["error_code"] == SE.ERR_NO_AUDIO
    r = SE.analyze_speech("not base64 !!!")
    assert r["status"] == "analysis_failed" and r["output"] is None


def test_too_short_audio_is_insufficient_data():
    r = SE.analyze_speech(_wav_b64(seconds=1.0), "audio/wav")
    assert r["status"] == "insufficient_data" and r["error_code"] == SE.ERR_TOO_SHORT


def test_valid_audio_gives_measurements_but_no_classification():
    r = SE.analyze_speech(_wav_b64(), "audio/wav")
    assert r["status"] == "model_unavailable" and r["output"] is None and r["error_code"] == SE.ERR_NO_MODEL
    assert len(SF.feature_vector(r["features"])) == len(SF.VECTOR_NAMES) and r["features"]["pitch_mean"] > 0
    assert "clinical_flags" not in r and "score" not in r and "probability" not in r


def test_synthetic_proxy_cnn_is_never_loaded():
    assert not SE.QUARANTINED.exists()                            # moved to models/quarantine/
    assert not hasattr(SE, "_SPEECH_MODEL") and not (SE.MODELS_DIR / "speech_cnn.pt").exists()


def test_classifier_loader_accepts_only_safe_valid_participant_level_json(tmp_path):
    n = len(SF.VECTOR_NAMES)
    good = {"coef": [0.0] * n, "intercept": 0.0, "mean": [0.0] * n, "scale": [1.0] * n,
            "metadata": {"feature_names": list(SF.VECTOR_NAMES), "participant_level_split": True, "is_synthetic_proxy": False}}
    p = tmp_path / "m.json"; p.write_text(json.dumps(good))
    clf, why = SE.load_classifier(p)
    assert clf is not None and why is None
    for mutate in (lambda d: d["metadata"].__setitem__("is_synthetic_proxy", True),
                   lambda d: d["metadata"].__setitem__("participant_level_split", False),
                   lambda d: d["metadata"].__setitem__("feature_names", ["x"]),
                   lambda d: d.__setitem__("coef", [0.0])):
        bad = json.loads(json.dumps(good)); mutate(bad); p.write_text(json.dumps(bad))
        assert SE.load_classifier(p)[0] is None
    p.write_bytes(b"\x80\x04 pickle-ish bytes")                  # a pickle is never deserialised
    assert SE.load_classifier(p)[0] is None
    assert SE.load_classifier(tmp_path / "missing.json")[0] is None


def test_loaded_experimental_classifier_is_still_not_in_the_result(tmp_path, monkeypatch):
    n = len(SF.VECTOR_NAMES)
    ck = {"coef": [0.0] * n, "intercept": 0.0, "mean": [0.0] * n, "scale": [1.0] * n,
          "metadata": {"feature_names": list(SF.VECTOR_NAMES), "participant_level_split": True, "is_synthetic_proxy": False,
                       "model_version": "speech-test", "dataset": "unit-test"}}
    (tmp_path / "m.json").write_text(json.dumps(ck))
    monkeypatch.setattr(SE, "CLASSIFIER_PATH", tmp_path / "m.json")
    monkeypatch.setattr(SE, "load_classifier", lambda path=tmp_path / "m.json", _f=SE.load_classifier: _f(path))
    r = SE.analyze_speech(_wav_b64(), "audio/wav")
    assert r["status"] == "available_experimental" and r["output"] == 0.5
    from backend.ml import modality_status as MS
    st = MS.speech_state(r, False)
    assert st["status"] == "available_experimental" and st["in_result"] is False


# ── facial ──────────────────────────────────────────────────────────────────

def _png_b64(img):
    import cv2
    ok, buf = cv2.imencode(".png", img); assert ok
    return base64.b64encode(buf.tobytes()).decode()


def test_facial_no_image_and_bad_image():
    assert FE.analyze_face("")["status"] == "insufficient_data"
    assert FE.analyze_face("###")["status"] == "analysis_failed"


def test_facial_blank_image_has_no_face_and_no_score():
    r = FE.analyze_face(_png_b64(np.full((240, 320, 3), 128, np.uint8)))
    assert r["status"] == "failed_quality" and r["error_code"] == FE.ERR_NO_FACE and r["output"] is None
    assert r["features"]["face_detected"] is False and "score" not in r


def test_facial_module_has_no_classifier_or_emotion_model():
    assert not hasattr(FE, "_FACIAL_MODEL") and not hasattr(FE, "_predict_cnn") and not hasattr(FE, "_predict_heuristic")
    from backend.ml import modality_status as MS
    st = MS.facial_state({"status": "model_unavailable", "features": {"face_detected": True}}, False)
    assert st["status"] == "model_unavailable" and st["output"] is None and st["in_result"] is False


def test_unvoiced_pitch_is_null_not_zero():
    features = SF.extract_features(np.zeros(22050 * 5), 22050)
    assert features['pitch_mean'] is None and features['pitch_std'] is None
    assert features['pitch_status'] == 'unavailable_no_voiced_frames'


def test_silent_audio_retains_measurements_but_withholds_emotion():
    import io, soundfile as sf
    buf=io.BytesIO();sf.write(buf,np.zeros(6*22050),22050,format='WAV')
    r=SE.analyze_speech(base64.b64encode(buf.getvalue()).decode(),'audio/wav',research_enabled=True)
    assert r['features']['energy_mean']==0.0  # genuinely measured silence, not a missing score
    assert r['emotion_result']['output'] is None
    assert r['emotion_result']['status']=='failed_quality'
    assert r['emotion_result']['status']=='failed_quality'


def test_noise_without_voiced_evidence_does_not_acquire_emotion_output():
    """Deterministic noise engineering input, not a speech validation dataset."""
    import io, soundfile as sf
    buf=io.BytesIO();sf.write(buf,np.random.default_rng(42).normal(0,.05,6*22050),22050,format='WAV')
    r=SE.analyze_speech(base64.b64encode(buf.getvalue()).decode(),'audio/wav',research_enabled=True)
    assert r['features']['spectral_flatness_median'] >= .5
    assert r['features']['energy_mean']>0
    assert r['emotion_result']['output'] is None


def test_emotion_receives_native_audio_not_acoustic_resample(monkeypatch):
    from backend.ml import research_inference as R
    seen=[]
    def classify(y,sr):
        seen.append((len(y),sr))
        return R.unavailable('speech','Controlled model boundary')
    monkeypatch.setattr(R,'speech_emotion',classify)
    r=SE.analyze_speech(_wav_b64(sr=48000),'audio/wav',research_enabled=True)
    assert r['features']['pitch_mean']>0
    assert seen==[(6*48000,48000)]


@pytest.mark.parametrize('case',['multiple','dark','blur'])
def test_detected_face_quality_rejection_retains_measurements(monkeypatch,case):
    """Controlled detection boundary; no claim about detector accuracy."""
    from backend.ml import cv_preprocessing as CV
    from backend.ml import research_inference as R
    monkeypatch.setattr(CV,'_detect_face',lambda *a:((0,0,64,64),'haar_frontalface'))
    monkeypatch.setattr(CV,'_detect_haar',lambda *a,**k:[(0,0,64,64)]*(2 if case=='multiple' else 1))
    monkeypatch.setattr(R,'face_expression',lambda *a:pytest.fail('quality-rejected face reached CNN'))
    img=np.full((64,64,3),0 if case=='dark' else 128,np.uint8)
    r=FE.analyze_face(_png_b64(img),research_enabled=True)
    assert r['status']=='failed_quality' and r['output'] is None
    assert r['features']['face_detected'] is True
    assert r['quality']['valid'] is False and r['reason']
