"""Gaze pipeline tests: preprocessing, checkpoint contract, service, API and fusion.

Service tests use a small randomly-initialised checkpoint written to tmp_path, so
they verify the *pipeline contract* (shapes, order, normalisation), not accuracy.
Tests marked "real checkpoint" use backend/models/gaze_lstm_browser.pt if present.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from backend.ml.fusion_engine import fuse
from backend.ml.gaze import config as C
from backend.ml.gaze import gaze_model_service as gms
from backend.ml.gaze.gaze_model_service import (
    BROWSER_CKPT, LEGACY_CKPT, CheckpointError, GazeModelService, legacy_checkpoint_report, validate_checkpoint,
)
from backend.ml.gaze.model import GazeLSTM
from backend.ml.gaze.preprocess import (
    build_feature_matrix, compute_dt, detect_fixations, normalize, pad_sequence,
    validate_samples,
)
from backend.schemas.gaze import GazeAnalyzeRequest

ROOT = Path(__file__).resolve().parents[2]
W, H = 1280.0, 720.0


# ── helpers ──────────────────────────────────────────────────────────────────

def make_samples(n=400, hz=30.0, start=1000.0, face=True, wander=True):
    """Smooth synthetic gaze path with a distinct fixation-like and moving phase."""
    step = 1000.0 / hz
    out = []
    for i in range(n):
        t = start + i * step
        if wander:
            x = W * (0.5 + 0.3 * math.sin(i / 25.0))
            y = H * (0.5 + 0.2 * math.cos(i / 40.0))
        else:
            x, y = W * 0.5, H * 0.5
        out.append({
            "timestamp": t, "x": x, "y": y,
            "stimulus_id": ["happy_face", "neutral_face"][(i // 100) % 2],
            "face_detected": face,
        })
    return out


def make_session(n=400, cal=0.8, completed=True, category="child", **kw):
    return {
        "session_id": "test-session",
        "category": category,
        "screen_width": W,
        "screen_height": H,
        "calibration": {"completed": completed, "quality_score": cal, "sample_count": 50},
        "samples": make_samples(n, **kw),
    }


def make_checkpoint(path: Path, **overrides) -> dict:
    torch.manual_seed(0)
    model = GazeLSTM(input_size=4, hidden_size=8, num_layers=2)
    ckpt = {
        "model_state_dict": model.state_dict(),
        "input_size": 4, "hidden_size": 8, "num_layers": 2,
        "lstm_dropout": 0.3, "fc_dropout": 0.4,
        "feature_names": list(C.FEATURE_NAMES),
        "mean": [0.5, 0.5, 0.1, 0.3],
        "std": [0.2, 0.2, 0.3, 0.4],
        "preprocess_config": C.preprocess_config(),
        "model_version": "gaze-test-v0",
        "cv_auc": 0.8, "domain_validated": False,
    }
    ckpt.update(overrides)
    torch.save(ckpt, path)
    return ckpt


@pytest.fixture()
def service(tmp_path):
    p = tmp_path / "gaze_test.pt"
    make_checkpoint(p)
    return GazeModelService(ckpt_path=p)


# ── 1-2. checkpoint loading + metadata validation ────────────────────────────

def test_checkpoint_loads(service):
    assert service.available
    assert service.model_version == "gaze-test-v0"
    assert service.status()["feature_names"] == list(C.FEATURE_NAMES)


@pytest.mark.parametrize("overrides,reason", [
    ({"feature_names": ["x", "y", "is_fixation", "speed"]}, "feature_order_mismatch"),
    ({"feature_names": ["x", "y", "speed", "pupil_diam"]}, "requires_unavailable_feature"),
    ({"preprocess_config": {**C.preprocess_config(), "seq_len": 999}}, "preprocess_config_mismatch"),
    ({"mean": [0.0]}, "normalization_mismatch"),
    ({"input_size": 5}, "input_size_mismatch"),
])
def test_metadata_validation_rejects(overrides, reason):
    ckpt = {
        "model_state_dict": {}, "input_size": 4, "hidden_size": 8, "num_layers": 2,
        "feature_names": list(C.FEATURE_NAMES), "mean": [0] * 4, "std": [1] * 4,
        "preprocess_config": C.preprocess_config(), "model_version": "v",
    }
    ckpt.update(overrides)
    with pytest.raises(CheckpointError) as e:
        validate_checkpoint(ckpt)
    assert e.value.reason == reason


def test_incomplete_checkpoint_rejected():
    with pytest.raises(CheckpointError) as e:
        validate_checkpoint({"model_state_dict": {}})
    assert e.value.reason == "checkpoint_incomplete"


# ── 3-4. sample validation ───────────────────────────────────────────────────

def test_valid_samples_normalised_to_unit_square():
    c = validate_samples(make_samples(50), W, H)
    assert c.n_total == 50 and c.n_valid == 50 and c.valid_ratio == 1.0
    assert c.x.min() >= 0 and c.x.max() <= 1 and c.y.min() >= 0 and c.y.max() <= 1


def test_invalid_samples_rejected_with_counts():
    good = {"timestamp": 100.0, "x": 10.0, "y": 10.0}
    bad = [
        {"timestamp": float("nan"), "x": 1.0, "y": 1.0},                # non_finite
        {"timestamp": 200.0, "x": float("inf"), "y": 1.0},              # non_finite
        {"timestamp": -5.0, "x": 1.0, "y": 1.0},                        # negative_timestamp
        {"timestamp": 100.0, "x": 1.0, "y": 1.0},                       # non_monotonic (dup)
        {"timestamp": 300.0, "x": None, "y": None, "face_detected": False},  # face
        {"timestamp": 400.0, "x": W + 1, "y": 5.0},                     # out_of_bounds
        {"timestamp": 500.0, "x": 5.0, "y": -0.1},                      # out_of_bounds
    ]
    c = validate_samples([good] + bad, W, H)
    assert c.n_valid == 1 and c.n_total == 8
    assert c.rejected == {
        "non_finite": 2, "negative_timestamp": 1, "non_monotonic": 1,
        "face_not_detected": 1, "out_of_bounds": 2, "tracker_placeholder": 0,
    }
    ph = validate_samples([{"timestamp": 1.0, "x": 0.0, "y": 0.0}, {"timestamp": 2.0, "x": 0.0, "y": 5.0}], W, H)
    assert ph.rejected["tracker_placeholder"] == 1 and ph.n_valid == 1     # only exact (0,0) is a no-data code


# ── 5. dt is derived from timestamps ─────────────────────────────────────────

def test_dt_from_timestamps_and_client_dt_not_accepted():
    dt = compute_dt(np.array([100.0, 133.0, 200.0]))
    assert dt.tolist() == [0.0, 33.0, 67.0]
    body = make_session(120)
    body["samples"][0]["dt"] = 5
    with pytest.raises(Exception):
        GazeAnalyzeRequest(**body)            # extra="forbid": client dt is refused


# ── 6-9. sequence construction ───────────────────────────────────────────────

def test_sequence_shape_and_feature_order():
    c = validate_samples(make_samples(300, hz=30), W, H)
    feats = build_feature_matrix(c)
    assert feats.dtype == np.float32 and feats.shape[1] == len(C.FEATURE_NAMES) == 4
    assert C.FEATURE_NAMES == ("x", "y", "speed", "is_fixation")
    assert 0 <= feats[:, 0].min() and feats[:, 0].max() <= 1        # x
    assert 0 <= feats[:, 1].min() and feats[:, 1].max() <= 1        # y
    assert (feats[:, 2] >= 0).all() and feats[1:, 2].max() > 0       # speed
    assert set(np.unique(feats[:, 3])) <= {0.0, 1.0}                 # is_fixation
    # 10 s of data at 10 Hz -> ~100 steps
    assert 95 <= len(feats) <= 101


def test_resample_grid_is_uniform_10hz():
    c = validate_samples(make_samples(300, hz=47.0), W, H)   # jittery source rate
    feats = build_feature_matrix(c)
    duration_ms = c.t_ms[-1] - c.t_ms[0]
    assert abs(len(feats) - (duration_ms // C.STEP_MS + 1)) <= 1


def test_fixation_rule_stationary_vs_moving():
    still = validate_samples(make_samples(120, wander=False), W, H)
    assert detect_fixations(still.t_ms, still.x, still.y).mean() == 1.0
    t = np.arange(0, 3000, 33.0)
    fast_x = (np.sin(t / 60.0) * 0.4 + 0.5)
    assert detect_fixations(t, fast_x, np.full_like(t, 0.5)).mean() < 0.2


def test_gap_breaks_segment_and_is_not_interpolated():
    a = make_samples(60, hz=30, start=0)
    b = make_samples(60, hz=30, start=10_000)                 # 8 s hole
    c = validate_samples(a + b, W, H)
    feats = build_feature_matrix(c)
    assert len(feats) < 45      # ~2 x 2 s of steps, not ~12 s of interpolated steps
    assert feats[:, 2].max() < 5  # no fake speed spike across the hole


def test_padding_and_truncation(service):
    short = build_feature_matrix(validate_samples(make_samples(300), W, H))
    x, lengths = service.build_tensor(short)
    assert x.shape == (1, C.SEQ_LEN, 4) and x.dtype == torch.float32
    assert lengths.item() == len(short) < C.SEQ_LEN
    assert torch.all(x[0, len(short):] == 0)                  # zero padding after normalisation

    long = build_feature_matrix(validate_samples(make_samples(3000, hz=30), W, H))   # 100 s
    assert len(long) == C.SEQ_LEN                             # truncated to the first 300 steps
    x2, l2 = service.build_tensor(long)
    assert x2.shape == (1, C.SEQ_LEN, 4) and l2.item() == C.SEQ_LEN


# ── 10. pupil / unavailable features ─────────────────────────────────────────

def test_pupil_is_never_accepted_or_invented():
    body = make_session(120)
    body["samples"][0]["pupil"] = 4.0
    with pytest.raises(Exception):
        GazeAnalyzeRequest(**body)
    assert "pupil" not in " ".join(C.FEATURE_NAMES)
    assert "pupil_diam" not in C.BROWSER_AVAILABLE_FEATURES


def test_legacy_pupil_model_is_refused(tmp_path):
    p = tmp_path / "legacy.pt"
    make_checkpoint(p, feature_names=["x", "y", "dt_ms", "is_fixation", "pupil_diam"], input_size=5)
    svc = GazeModelService(ckpt_path=p)
    assert not svc.available
    out = svc.analyze(make_session(400))
    assert out["status"] == "unavailable" and out["probability"] is None
    assert out["reason"] in ("requires_unavailable_feature", "checkpoint_load_failed")


# ── 11-12. calibration + session quality ─────────────────────────────────────

@pytest.mark.parametrize("kwargs,reason", [
    ({"cal": 0.1}, "poor_calibration"),
    ({"cal": 0.8, "completed": False}, "calibration_incomplete"),
    ({"n": 30}, "insufficient_samples"),
    ({"n": 120, "hz": 30.0}, "insufficient_usable_duration"),    # 4 s
    ({"face": False}, "face_not_detected"),
])
def test_quality_gate_blocks_inference(service, kwargs, reason):
    out = service.analyze(make_session(**kwargs))
    assert out["status"] == "insufficient_quality"
    assert out["probability"] is None and out["score"] is None
    assert out["quality"]["valid"] is False and reason in out["quality"]["reasons"]
    assert out["reason"] in out["quality"]["reasons"]


def test_unsupported_category_is_unavailable(service):
    out = service.analyze(make_session(category="adult"))
    assert out["status"] == "unavailable" and out["reason"] == "category_not_supported"
    assert out["probability"] is None


# ── 13. successful inference + THE tensor contract ───────────────────────────

def test_inference_tensor_contract(tmp_path):
    p = tmp_path / "g.pt"
    ckpt = make_checkpoint(p)
    svc = GazeModelService(ckpt_path=p)
    seen = {}
    real = svc.model

    class Spy(torch.nn.Module):
        def forward(self, x, lengths):
            seen["x"], seen["lengths"] = x.clone(), lengths.clone()
            return real(x, lengths)

    svc.model = Spy()
    session = make_session(600)
    out = svc.analyze(session)

    assert out["status"] == "success" and out["model_status"] == "trained"
    assert out["model_version"] == "gaze-test-v0"
    assert 0.0 <= out["probability"] <= 1.0 and out["score"] == out["probability"]
    assert out["is_trained_model"] is True and out["isMock"] is False

    x, lengths = seen["x"], seen["lengths"]
    # exact sequence length, feature count, dtype, batch dimension
    assert tuple(x.shape) == (1, C.SEQ_LEN, len(C.FEATURE_NAMES)) == (1, 300, 4)
    assert x.dtype == torch.float32 and lengths.dtype == torch.long

    # exact feature order + normalisation: rebuild independently from the raw session
    clean = validate_samples(session["samples"], W, H)
    raw = build_feature_matrix(clean)
    expected = (raw - np.asarray(ckpt["mean"], np.float32)) / np.asarray(ckpt["std"], np.float32)
    n = int(lengths.item())
    assert n == len(raw)
    np.testing.assert_allclose(x[0, :n].numpy(), expected, rtol=1e-5, atol=1e-6)
    assert torch.all(x[0, n:] == 0)
    for col, name in enumerate(C.FEATURE_NAMES):
        np.testing.assert_allclose(x[0, :n, col].numpy() * ckpt["std"][col] + ckpt["mean"][col],
                                   raw[:, col], rtol=1e-4, atol=1e-5, err_msg=name)


def test_invalid_probability_never_returned(service, monkeypatch):
    monkeypatch.setattr(service, "predict_features", lambda f: float("nan"))
    # predict_features raising/NaN path is wrapped: result must be unavailable, no probability
    monkeypatch.setattr(service, "predict_features",
                        lambda f: (_ for _ in ()).throw(ValueError("bad")))
    out = service.analyze(make_session(600))
    assert out["status"] == "unavailable" and out["reason"] == "inference_failed"
    assert out["probability"] is None


# ── 14. unavailable model ────────────────────────────────────────────────────

def test_missing_checkpoint_is_unavailable(tmp_path):
    svc = GazeModelService(ckpt_path=tmp_path / "nope.pt")
    out = svc.analyze(make_session(400))
    assert not svc.available
    assert out["status"] == "unavailable" and out["model_status"] == "unavailable"
    assert out["probability"] is None and out["score"] is None
    assert out["is_trained_model"] is False


def test_corrupt_checkpoint_is_unavailable(tmp_path):
    p = tmp_path / "bad.pt"
    p.write_bytes(b"not a checkpoint")
    svc = GazeModelService(ckpt_path=p)
    assert svc.analyze(make_session(400))["status"] == "unavailable"


# ── 15. API: malformed payloads + shape of valid responses ───────────────────

@pytest.fixture()
def client(app_client):
    c = app_client()
    c.post("/auth/register", json={"name": "G", "email": "gaze@example.com", "password": "correct-horse-9"})
    return c


@pytest.mark.parametrize("mutate", [
    lambda b: b.pop("calibration"),
    lambda b: b.update(category="martian"),
    lambda b: b.update(screen_width=5),
    lambda b: b.update(samples="oops"),
    lambda b: b["samples"][0].update(timestamp="abc"),
    lambda b: b["samples"][0].update(x=None, y=None),           # face_detected true but no coords
    lambda b: b.update(surprise=1),
    lambda b: b["calibration"].update(quality_score=7),
])
def test_malformed_payload_is_422(client, mutate):
    body = make_session(120)
    mutate(body)
    assert client.post("/gaze/analyze", json=body).status_code == 422


def test_api_response_schema_and_no_fabrication(client):
    r = client.post("/gaze/analyze", json=make_session(30))
    assert r.status_code == 200
    d = r.json()
    assert d["modality"] == "gaze" and d["status"] in ("success", "insufficient_quality", "unavailable")
    assert set(d["quality"]) >= {"valid", "reason", "sample_count", "valid_ratio", "calibration_score"}
    if d["status"] != "success":
        assert d["probability"] is None


# ── fusion: unavailable gaze must not be read as 0 ───────────────────────────

def test_fusion_ignores_unavailable_gaze():
    base = fuse(0.6, gaze_result=None, category="child")
    unavailable = fuse(0.6, gaze_result={"score": None, "is_trained_model": False}, category="child")
    assert unavailable.final_probability == base.final_probability == 0.6
    assert unavailable.gaze_score is None
    g = next(c for c in unavailable.modality_breakdown if c.modality == "gaze")
    assert g.available is False


def test_fusion_uses_successful_gaze():
    r = fuse(0.6, gaze_result={"score": 0.2, "is_trained_model": True, "method": "lstm_trained"},
             category="child")
    assert r.gaze_score == 0.2
    assert r.final_probability == pytest.approx((0.4 * 0.6 + 0.2 * 0.2) / 0.6, abs=1e-3)


# ── 16. frontend <-> backend schema compatibility ────────────────────────────

def test_frontend_payload_keys_match_backend_schema():
    src = (ROOT / "src" / "components" / "GazeSession.jsx").read_text()

    def keys(block_start: str) -> set[str]:
        """Top-level keys of the object literal that follows block_start."""
        i = src.index(block_start) + len(block_start)
        depth, out, j = 1, set(), i
        while depth:
            ch = src[j]
            depth += ch in "{([" ; depth -= ch in "})]"
            j += 1
        body = src[i:j - 1]
        d, cur = 0, ""
        for ch in body:
            d += ch in "{([" ; d -= ch in "})]"
            cur += ch if d == 0 else ""
        return set(re.findall(r"(?:^|,)\s*(\w+)\s*(?::|(?=,|$))", cur))

    sample_keys = keys("task.samples.push({")
    cal_keys = keys("calibration: {")
    session_keys = keys("sessionRef.current = {")

    assert sample_keys <= set(GazeAnalyzeRequest.model_fields["samples"].annotation.__args__[0].model_fields)
    assert cal_keys <= set(GazeAnalyzeRequest.model_fields["calibration"].annotation.model_fields)
    assert session_keys <= set(GazeAnalyzeRequest.model_fields)
    # everything the backend requires is sent
    required = {n for n, f in GazeAnalyzeRequest.model_fields.items() if f.is_required()}
    assert required <= session_keys
    # stimulus ids the frontend emits are the ones the summary logic knows about
    stim = set(re.findall(r"key: '(\w+)', label:", src))
    from backend.ml.gaze.preprocess import SOCIAL_STIMULI
    assert SOCIAL_STIMULI <= stim
    # a payload shaped exactly like the JS builds it validates
    GazeAnalyzeRequest(**make_session(150))


# ── real checkpoint (skipped until train_gaze_browser.py has been run) ───────

real = pytest.mark.skipif(not BROWSER_CKPT.exists(), reason="gaze_lstm_browser.pt not trained yet")


@real
def test_real_checkpoint_loads_and_scores():
    svc = GazeModelService()
    assert svc.available, svc.status()
    assert svc.meta["feature_names"] == list(C.FEATURE_NAMES)
    assert svc.meta["domain_validated"] is False
    out = svc.analyze(make_session(600))
    assert out["status"] == "success" and 0.0 <= out["probability"] <= 1.0
    assert out["model_version"] == svc.meta["model_version"]


# ── compatibility of the ORIGINAL checkpoint (gaze_lstm.pt) ──────────────────

def test_original_checkpoint_is_reported_incompatible_with_reasons():
    rep = legacy_checkpoint_report()
    assert rep["present"] and rep["compatible"] is False
    assert "pupil_diam" in rep["features"] and rep["sequence_length"] == 2000
    blocking = " ".join(rep["blocking"])
    assert "pupil_diam" in blocking and "is_fixation" in blocking and "dt_ms" in blocking


def test_service_refuses_original_checkpoint_with_explicit_error_code():
    svc = GazeModelService(ckpt_path=LEGACY_CKPT)
    assert not svc.available and svc.model_status == "incompatible"
    out = svc.analyze(make_session(600))
    assert out["status"] == "unavailable" and out["model_status"] == "incompatible"
    assert out["probability"] is None and out["score"] is None
    assert out["error_code"] == C.ERR_INPUT_INCOMPATIBLE
    assert out["preprocessing_version"] == C.GAZE_PREPROCESSING_VERSION


def test_preprocessing_version_mismatch_is_refused(tmp_path):
    p = tmp_path / "old.pt"
    make_checkpoint(p, preprocess_config={**C.preprocess_config(), "version": "1.0.0"})
    svc = GazeModelService(ckpt_path=p)
    assert svc.model_status == "incompatible"
    assert svc.analyze(make_session(600))["error_code"] == C.ERR_PREPROCESS_MISMATCH


def test_missing_checkpoint_error_code(tmp_path):
    out = GazeModelService(ckpt_path=tmp_path / "none.pt").analyze(make_session(600))
    assert out["model_status"] == "unavailable" and out["error_code"] == C.ERR_MODEL_MISSING


def test_health_and_model_info_expose_contract_but_no_paths(service):
    h = service.health()
    assert h["loaded"] and h["expected_features"] == 4 and h["sequence_length"] == 300
    assert h["model_version"] == "gaze-test-v0" and h["preprocessing_version"] == C.GAZE_PREPROCESSING_VERSION
    assert "/" not in str(h) or "gaze-test" in str(h)
    assert not any(str(ROOT) in str(v) for v in h.values())
    assert service.get_model_info()["legacy_checkpoint"]["compatible"] is False


# ── warnings are non-fatal ───────────────────────────────────────────────────

def test_marginal_calibration_warns_but_still_scores(service):
    out = service.analyze(make_session(600, cal=0.5))
    assert out["status"] == "success" and "marginal_calibration" in out["quality"]["warnings"]
    assert out["quality"]["duration_ms"] > 15000


def test_clean_session_has_no_warnings(service):
    assert service.analyze(make_session(600, cal=0.9))["quality"]["warnings"] == []


def test_tracker_placeholder_points_are_not_gaze():
    s = make_samples(50)
    s[10].update(x=0.0, y=0.0)
    c = validate_samples(s, W, H)
    assert c.rejected["tracker_placeholder"] == 1 and c.n_valid == 49


# ── fusion eligibility from validation performance ───────────────────────────

def test_model_below_validation_threshold_is_shown_but_not_fused(tmp_path):
    p = tmp_path / "weak.pt"
    make_checkpoint(p, cv_auc=0.60)
    out = GazeModelService(ckpt_path=p).analyze(make_session(600))
    assert out["status"] == "success" and out["probability"] is not None
    assert out["fusion_eligible"] is False and out["is_trained_model"] is False
    r = fuse(0.6, gaze_result=out, category="child")
    assert r.final_probability == 0.6                       # gaze did not move the result
    assert r.gaze_score == out["probability"] and r.heuristic_signal == out["probability"]


def test_validated_model_is_fused(tmp_path):
    p = tmp_path / "ok.pt"
    make_checkpoint(p, cv_auc=0.85)
    out = GazeModelService(ckpt_path=p).analyze(make_session(600))
    assert out["fusion_eligible"] is True and out["is_trained_model"] is True
    assert fuse(0.6, gaze_result=out, category="child").final_probability != 0.6


# ── API + storage ────────────────────────────────────────────────────────────

def test_api_reports_incompatible_model(client, monkeypatch):
    monkeypatch.setattr(gms, "_service", GazeModelService(ckpt_path=LEGACY_CKPT))
    d = client.post("/gaze/analyze", json=make_session(600)).json()
    assert d["status"] == "unavailable" and d["model_status"] == "incompatible"
    assert d["probability"] is None and d["error_code"] == "GAZE_MODEL_INPUT_INCOMPATIBLE"


def test_api_success_response_fields(client, monkeypatch, tmp_path):
    p = tmp_path / "g.pt"; make_checkpoint(p)
    monkeypatch.setattr(gms, "_service", GazeModelService(ckpt_path=p))
    d = client.post("/gaze/analyze", json=make_session(600)).json()
    assert d["status"] == "success" and d["model_status"] == "trained"
    assert d["model_version"] == "gaze-test-v0" and d["preprocessing_version"] == C.GAZE_PREPROCESSING_VERSION
    assert {"valid", "sample_count", "valid_ratio", "calibration_score", "duration_ms", "warnings"} <= set(d["quality"])


def test_case_stores_backend_gaze_object_and_unavailable_is_not_zero(client, monkeypatch, tmp_path):
    from backend.tests.conftest import screening_body
    p = tmp_path / "g.pt"; make_checkpoint(p, cv_auc=0.9)
    monkeypatch.setattr(gms, "_service", GazeModelService(ckpt_path=p))
    ok = client.post("/screening/screen", json=screening_body(gazeSession=make_session(600), gazeSkipped=False)).json()
    g = client.get(f"/cases/{ok['caseId']}").json()["gaze"]
    assert g["available"] is True and g["model_status"] == "trained" and g["fusion_eligible"] is True
    assert g["probability"] == ok["gazeResult"]["probability"]          # what the UI shows == what the backend computed
    assert g["model_version"] == "gaze-test-v0" and g["quality"]["valid"] is True

    monkeypatch.setattr(gms, "_service", GazeModelService(ckpt_path=LEGACY_CKPT))
    bad = client.post("/screening/screen", json=screening_body(gazeSession=make_session(600), gazeSkipped=False)).json()
    g2 = client.get(f"/cases/{bad['caseId']}").json()["gaze"]
    assert g2["available"] is False and g2["probability"] is None and g2["error_code"] == "GAZE_MODEL_INPUT_INCOMPATIBLE"
    comp = {c["modality"]: c for c in bad["modalityBreakdown"]["components"]}["gaze"]
    assert comp["available"] is False


def test_skipped_gaze_is_recorded_as_unavailable_not_zero(client):
    from backend.tests.conftest import screening_body
    cid = client.post("/screening/screen", json=screening_body()).json()["caseId"]
    g = client.get(f"/cases/{cid}").json()["gaze"]
    assert g["available"] is False and g["status"] == "skipped" and g["probability"] is None


# ── end-to-end contract with the REAL trained checkpoint ─────────────────────

@real
def test_integration_payload_to_tensor_to_real_lstm_to_api(client, monkeypatch):
    """frontend-shaped payload -> API -> preprocessing -> tensor -> gaze_lstm_browser.pt -> probability."""
    monkeypatch.setattr(gms, "_service", None)                 # load the real checkpoint fresh
    svc = gms.get_gaze_service()
    assert svc.available, svc.status()
    ckpt = torch.load(BROWSER_CKPT, map_location="cpu", weights_only=True)

    seen = {}
    real_model = svc.model

    class Spy(torch.nn.Module):
        def forward(self, x, lengths):
            seen["x"], seen["l"] = x.detach().clone(), lengths.clone()
            return real_model(x, lengths)

    svc.model = Spy()
    session = make_session(700, cal=0.85)                       # identical shape to GazeSession.jsx's payload
    api = client.post("/gaze/analyze", json=session).json()
    assert api["status"] == "success" and api["model_version"] == ckpt["model_version"]

    # tensor contract (training == inference)
    x, n = seen["x"], int(seen["l"].item())
    assert tuple(x.shape) == (1, ckpt["preprocess_config"]["seq_len"], len(ckpt["feature_names"])) == (1, 300, 4)
    assert x.dtype == torch.float32
    assert ckpt["feature_names"] == list(C.FEATURE_NAMES) == ["x", "y", "speed", "is_fixation"]
    assert ckpt["preprocess_config"] == C.preprocess_config()
    raw = build_feature_matrix(validate_samples(session["samples"], W, H))
    expected = (raw - np.asarray(ckpt["mean"], np.float32)) / np.asarray(ckpt["std"], np.float32)
    np.testing.assert_allclose(x[0, :n].numpy(), expected, rtol=1e-5, atol=1e-6)
    assert torch.all(x[0, n:] == 0)
    assert 0 <= raw[:, 0].min() and raw[:, 0].max() <= 1 and set(np.unique(raw[:, 3])) <= {0.0, 1.0}

    # the API probability is exactly what the checkpoint's weights produce on that tensor
    m = GazeLSTM(**{k: ckpt[k] for k in ("input_size", "hidden_size", "num_layers", "lstm_dropout", "fc_dropout")})
    m.load_state_dict(ckpt["model_state_dict"]); m.eval()
    with torch.no_grad():
        independent = float(torch.sigmoid(m(x, seen["l"]))[0])
    assert api["probability"] == pytest.approx(independent, abs=1e-4)

    # the model is below the fusion threshold -> shown but not fused
    assert api["fusion_eligible"] == (ckpt["cv_auc"] >= C.MIN_FUSION_CV_AUC)
    assert api["validation"]["domain_validated"] is False


def test_transient_load_failure_recovers_without_restart(tmp_path):
    p = tmp_path / "late.pt"
    svc = GazeModelService(ckpt_path=p)                      # file not there yet
    assert svc.analyze(make_session(600))["error_code"] == C.ERR_MODEL_MISSING
    make_checkpoint(p)                                       # ...then it appears
    svc.RELOAD_INTERVAL_S = 0.0
    assert svc.analyze(make_session(600))["status"] == "success"


def test_deliberate_incompatibility_is_not_retried(tmp_path):
    p = tmp_path / "pupil.pt"
    make_checkpoint(p, feature_names=["x", "y", "speed", "pupil_diam"])
    svc = GazeModelService(ckpt_path=p); svc.RELOAD_INTERVAL_S = 0.0
    make_checkpoint(p)                                       # even if replaced, only a restart re-validates
    assert svc.analyze(make_session(600))["model_status"] == "incompatible"


def test_skip_reason_is_stored_and_reported(client):
    from backend.tests.conftest import screening_body
    cid = client.post("/screening/screen", json=screening_body(gazeSkipReason="calibration_poor")).json()["caseId"]
    g = client.get(f"/cases/{cid}").json()["gaze"]
    assert g["status"] == "skipped" and g["reason"] == "calibration_poor" and g["probability"] is None
    bad = screening_body(gazeSkipReason="Robert'); DROP")
    assert client.post("/screening/screen", json=bad).status_code == 422       # constrained to a-z_


def test_breakdown_reports_weight_and_realised_contribution():
    from backend.ml.fusion_engine import modality_breakdown_as_dicts
    r = fuse(0.6, gaze_result={"score": 0.2, "is_trained_model": True, "method": "lstm_trained"}, category="child")
    d = {c["modality"]: c for c in modality_breakdown_as_dicts(r.modality_breakdown)}
    assert d["questionnaire"]["weight"] == 0.4 and d["gaze"]["weight"] == 0.2
    assert d["questionnaire"]["contribution"] + d["gaze"]["contribution"] == pytest.approx(1.0, abs=1e-3)
    assert d["speech"]["contribution"] == 0 and d["facial"]["contribution"] == 0
    # supplemental (not fused) gaze contributes nothing
    r2 = fuse(0.6, gaze_result={"score": 0.2, "is_trained_model": False}, category="child")
    d2 = {c["modality"]: c for c in modality_breakdown_as_dicts(r2.modality_breakdown)}
    assert d2["gaze"]["contribution"] == 0 and d2["questionnaire"]["contribution"] == 1.0


def test_dashboard_modality_status_is_computed_from_real_cases(client):
    from backend.tests.conftest import screening_body
    client.post("/screening/screen", json=screening_body())
    d = client.get("/cases/dashboard/summary").json()
    ms = {m["id"]: m for m in d["modalityStatus"]}
    assert ms["questionnaire"]["available"] == 1 and ms["questionnaire"]["total"] == 1
    assert ms["gaze"]["available"] == 0 and ms["gaze"]["used_in_fusion"] == 0
    assert "modalityConfidence" not in d           # the old hard-coded percentages are gone


def test_quality_reports_sampling_rate_and_tracking_continuity(service):
    q = service.analyze(make_session(600, hz=30.0))["quality"]
    assert q["sampling_rate_hz"] == pytest.approx(30.0, abs=1.0)
    assert q["tracking_continuity"] == pytest.approx(1.0, abs=1e-6)
    holed = make_samples(200, hz=30, start=0) + make_samples(200, hz=30, start=20_000)   # 13 s hole
    s = make_session(600); s["samples"] = holed
    assert service.analyze(s)["quality"]["tracking_continuity"] < 0.7
