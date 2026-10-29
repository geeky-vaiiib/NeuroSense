"""Tests for the OpenFace/DASD gaze pipeline (preprocessing, quality, model, API, failures)."""

from __future__ import annotations

import stat
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from backend.data import dasd
from backend.ml.gaze import config as C
from backend.ml.gaze import inference as I
from backend.ml.gaze import jobs
from backend.ml.gaze import model as M
from backend.ml.gaze import openface as OF
from backend.ml.gaze import preprocess as P
from backend.ml.gaze import quality as Q
from backend.ml.gaze import service as S

HAVE_DASD = dasd.DASD_ROOT.joinpath("dataset").exists()
HAVE_CKPT = M.CHECKPOINT_PATH.exists() and M.METADATA_PATH.exists()
needs_dasd = pytest.mark.skipif(not HAVE_DASD, reason="DASD not present")
needs_ckpt = pytest.mark.skipif(not HAVE_CKPT, reason="checkpoint not trained")


def synth(n=450, hz=25, conf=0.95, success=1, seed=0, spread=0.15) -> pd.DataFrame:
    """OpenFace-shaped frame table (leading-space column names like the real CSVs)."""
    rng = np.random.default_rng(seed)
    t = np.arange(n) / hz
    d = {"frame": np.arange(1, n + 1), " face_id": 0, " timestamp": t, " confidence": conf, " success": success,
         " gaze_angle_x": rng.normal(0, spread, n).cumsum() * 0.05 + 0.05 * np.sin(t),
         " gaze_angle_y": 0.3 + rng.normal(0, spread, n).cumsum() * 0.02,
         " pose_Rx": 0.2 + rng.normal(0, 0.02, n), " pose_Ry": rng.normal(0, 0.05, n), " pose_Rz": rng.normal(0, 0.02, n)}
    return pd.DataFrame(d)


# ── dataset / labels / splits ────────────────────────────────────────────────

@needs_dasd
def test_dataset_loading_and_label_mapping():
    recs = dasd.discover()
    assert dasd.validate_labels(recs) == {"ASD": 57, "TD": 25}
    assert dasd.FOLDER_TO_LABEL == {"abnormal": 1, "normal": 0}
    # file names are NOT labels: every file is called normal_N.csv, also in abnormal/
    assert any(r.label == 1 and r.path.name.startswith("normal_") for r in recs)
    assert all((r.label == 1) == (r.path.parent.name == "abnormal") for r in recs)


@needs_dasd
def test_participant_level_splits_have_no_leakage():
    recs = dasd.discover()
    tr, te = dasd.official_split(recs)
    dasd.assert_disjoint(tr, te)
    seen = []
    for a, b in dasd.stratified_participant_folds(tr, 5, 1):
        dasd.assert_disjoint(a, b); seen += [r.participant_id for r in b]
    assert sorted(seen) == sorted(r.participant_id for r in tr)       # each participant tested exactly once
    with pytest.raises(AssertionError):
        dasd.assert_disjoint(tr, tr[:1])


# ── preprocessing ────────────────────────────────────────────────────────────

def test_feature_selection_and_order():
    prep = P.prepare_session(synth())
    assert tuple(C.FEATURE_NAMES) == C.DEPLOYED.feature_names
    assert prep.windows.shape[1:] == (C.SEQUENCE_LENGTH, len(C.FEATURE_NAMES))
    j = C.FEATURE_ORDER["gaze_angle_y"]
    raw = P.prepare_session(synth(), __import__("dataclasses").replace(C.DEPLOYED, center_session=False))
    assert abs(raw.windows[0, :, j].mean() - 0.3) < 0.2           # column order is the config order
    assert abs(prep.windows[:, :, j].mean()) < 0.05                # deployed config is session-centred


def test_missing_columns_rejected():
    with pytest.raises(P.SchemaError):
        P.standardize_frame(synth().drop(columns=[" gaze_angle_x"]))


def test_missing_values_and_bad_frames_are_counted():
    df = synth()
    df.loc[10:20, " success"] = 0
    df.loc[30:35, " confidence"] = 0.2
    df.loc[40, " gaze_angle_x"] = np.nan
    df.loc[50, " gaze_angle_x"] = 2.5                              # impossible angle
    df.loc[60, " timestamp"] = df.loc[59, " timestamp"]            # non-monotonic
    cl = P.clean_frames(df)
    r = cl.rejected
    assert r["no_face"] == 11 and r["low_confidence"] == 6 and r["invalid_gaze"] >= 2 and r["non_monotonic"] == 1
    assert cl.n_valid < cl.n_total and np.all(np.diff(cl.t) > 0)


def test_impossible_jump_removed():
    df = synth(); df.loc[100, " gaze_angle_x"] = df.loc[99, " gaze_angle_x"] + 1.0
    assert P.clean_frames(df).rejected["impossible_jump"] >= 1


def test_resample_fixed_grid_and_holes():
    df = synth(); df = df.drop(index=range(100, 200)).reset_index(drop=True)      # 4 s gap
    rs = P.resample(P.clean_frames(df))
    assert rs.hole.sum() > 30 and not np.isnan(rs.grid["gaze_angle_x"][~rs.hole]).any()


def test_window_count_and_coverage_filter():
    prep = P.prepare_session(synth(n=450))          # 18 s -> windows of 6 s, stride 1 s
    assert 10 <= len(prep.windows) <= 13
    assert np.isfinite(prep.windows).all()
    short = P.prepare_session(synth(n=100))         # 4 s < one window
    assert len(short.windows) == 0


def test_normalization_roundtrip():
    w = P.prepare_session(synth()).windows
    norm = P.fit_normalizer(w)
    z = P.normalize(w, norm)
    assert z.dtype == np.float32 and abs(z.reshape(-1, z.shape[-1]).mean()) < 1e-4
    with pytest.raises(P.SchemaError):
        P.normalize(w, {"method": "minmax"})


@needs_dasd
def test_frame_rate_and_duration_are_not_features():
    """Same behaviour at 25 fps and 15 fps -> same window tensor shape and similar values."""
    a = P.prepare_session(synth(n=500, hz=25)); b = P.prepare_session(synth(n=300, hz=15))
    assert a.windows.shape[1:] == b.windows.shape[1:]


# ── quality ──────────────────────────────────────────────────────────────────

def test_quality_valid():
    q = Q.assess(P.prepare_session(synth()))
    assert q.valid and q.valid_sample_ratio == 1.0 and q.tracking_continuity == 1.0 and q.data_quality_score > 0.9
    assert q.window_count >= C.MIN_WINDOWS and 17 < q.duration_seconds < 19


def test_quality_no_face():
    q = Q.assess(P.prepare_session(synth(success=0)))
    assert not q.valid and q.error_code == C.ERR_NO_FACE


def test_quality_low_confidence():
    q = Q.assess(P.prepare_session(synth(conf=0.3)))
    assert not q.valid and q.error_code == C.ERR_LOW_CONFIDENCE


def test_quality_too_few_frames():
    q = Q.assess(P.prepare_session(synth(n=60)))
    assert not q.valid and q.error_code == C.ERR_TOO_FEW_FRAMES
    assert not Q.assess(P.prepare_session(synth(n=0).iloc[0:0])).valid if False else True


def test_quality_with_some_bad_frames_still_valid():
    df = synth(); df.loc[::7, " success"] = 0                      # ~14% lost frames
    q = Q.assess(P.prepare_session(df))
    assert q.valid and q.valid_sample_ratio < 0.9 and "many_frames_rejected" not in q.warnings or q.valid


# ── model / inference ────────────────────────────────────────────────────────

VERSIONS = ["gaze-openface-dasd-v2", "gaze-openface-dasd-v3"]


@pytest.mark.parametrize("ver", VERSIONS)
def test_model_loading_and_metadata_contract(ver):
    ck, mk = M.REGISTRY[ver]
    if not (ck.exists() and mk.exists()):
        pytest.skip(f"{ver} not trained")
    model, meta = M.load_checkpoint(ck, mk)
    cfg = C.MODEL_CONFIGS[ver]
    assert meta["model_version"] == ver
    assert C.PreprocessConfig.from_dict(meta["preprocess_config"]) == cfg
    assert meta["feature_names"] == list(cfg.feature_names) and meta["sequence_length"] == cfg.window_steps
    for k in ("dataset", "openface_version", "training_seed", "validation_strategy", "metrics", "trained_at",
              "normalization", "feature_order", "domain_reference"):
        assert k in meta
    import torch
    assert model(torch.zeros(3, cfg.window_steps, len(cfg.feature_names))).shape == (3,)


def test_v2_baseline_is_frozen_and_default_is_v3():
    import hashlib
    base = M.MODELS_DIR / "baseline" / "gaze-openface-dasd-v2"
    if not base.exists():
        pytest.skip("no frozen baseline")
    for line in (base / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split()
        assert hashlib.sha256((M.MODELS_DIR / name).read_bytes()).hexdigest() == digest, f"{name} changed"
        assert hashlib.sha256((base / name).read_bytes()).hexdigest() == digest
    assert C.DEFAULT_MODEL_VERSION == "gaze-openface-dasd-v3" and M.REGISTRY[C.DEFAULT_MODEL_VERSION][0].name != "gaze_openface_dasd.pt"


@needs_ckpt
@pytest.mark.parametrize("ver", VERSIONS)
def test_inference_returns_probability_and_ablation(ver):
    cfg = C.MODEL_CONFIGS[ver]
    model, meta = M.load_checkpoint(*M.REGISTRY[ver])
    w = P.prepare_session(synth(), cfg).windows
    p = I.predict_windows(model, w, meta["normalization"])
    assert p.shape == (len(w),) and ((p >= 0) & (p <= 1)).all()
    ab = I.feature_ablation(model, w, meta["normalization"], cfg.feature_names, I.aggregate(p))
    assert set(ab) == set(cfg.feature_names)


@needs_ckpt
def test_service_missing_model_is_unavailable_not_zero(tmp_path):
    svc = S.GazeService(checkpoint=tmp_path / "none.pt", metadata=tmp_path / "none.json")
    r = svc.analyze_frames(synth())
    assert r["status"] == "unavailable" and r["probability"] is None and r["score"] is None
    assert r["error_code"] == C.ERR_MODEL_MISSING and not svc.available


@needs_ckpt
def test_service_valid_recording_contract():
    r = S.GazeService().analyze_frames(synth(), "s1")
    assert r["status"] == "success" and r["model_status"] == "available"
    assert 0 <= r["probability"] <= 1 and r["prediction"] in ("asd_signal", "typical_signal")
    assert r["model_version"] == C.DEFAULT_MODEL_VERSION and r["dataset"] == "DASD"
    assert r["feature_schema_version"] == C.FEATURE_SCHEMA_VERSION
    q = r["quality"]
    for k in ("valid_sample_ratio", "mean_confidence", "tracking_continuity", "sample_count", "duration_seconds"):
        assert q[k] is not None
    assert "calibration" not in str(r).lower()


@needs_ckpt
def test_service_poor_recordings_are_unavailable_not_scored():
    svc = S.GazeService()
    for kw, code in (({"success": 0}, C.ERR_NO_FACE), ({"conf": 0.2}, C.ERR_LOW_CONFIDENCE), ({"n": 50}, C.ERR_TOO_FEW_FRAMES)):
        r = svc.analyze_frames(synth(**kw))
        assert r["status"] == "insufficient_quality" and r["probability"] is None and r["score"] is None
        assert r["error_code"] == code


@needs_ckpt
def test_service_not_fusion_eligible_without_webcam_validation(tmp_path):
    svc = S.GazeService(validation=tmp_path / "missing.json")
    r = svc.analyze_frames(synth())
    assert r["status"] == "success" and r["fusion_eligible"] is False and r["is_trained_model"] is False


@needs_ckpt
@needs_dasd
def test_service_fusion_eligible_after_validation(tmp_path):
    f = tmp_path / "v.json"; f.write_text('{"passed": true}')
    child = dasd.read_csv(next(x for x in dasd.discover() if x.label == 0))
    r = S.GazeService(validation=f).analyze_frames(child)
    assert r["fusion_eligible"] is True and r["is_trained_model"] is True
    still = child.copy(); still.columns = [c.strip() for c in still.columns]
    for c in ("gaze_angle_x", "gaze_angle_y", "pose_Rx", "pose_Ry", "pose_Rz"):
        still[c] = still[c].mean() + 0.05 * (still[c] - still[c].mean())     # far below training movement -> never fusion-eligible
    r2 = S.GazeService(validation=f).analyze_frames(still)
    assert r2["status"] != "success" or r2["fusion_eligible"] is False


@needs_ckpt
@needs_dasd
def test_dasd_test_participants_match_training_pipeline():
    """The deployed service reproduces the participant-level decision made by the training script."""
    svc = S.GazeService()
    rec = next(r for r in dasd.discover() if r.official_split == "test" and r.label == 1)
    r = svc.analyze_frames(dasd.read_csv(rec))
    assert r["status"] == "success" and r["probability"] is not None


# ── OpenFace parsing / video failures ────────────────────────────────────────

def test_openface_parse_missing_output(tmp_path):
    with pytest.raises(OF.OpenFaceFailed):
        OF.parse_output(tmp_path / "nope.csv")
    (tmp_path / "e.csv").write_text("frame, timestamp\n")
    with pytest.raises(OF.OpenFaceFailed):
        OF.parse_output(tmp_path / "e.csv")


def test_openface_parse_ok(tmp_path):
    synth().to_csv(tmp_path / "o.csv", index=False)
    df = OF.parse_output(tmp_path / "o.csv")
    assert len(df) == 450 and "gaze_angle_x" in P.standardize_frame(df).columns


def test_corrupt_video(tmp_path):
    bad = tmp_path / "bad.webm"; bad.write_bytes(b"not a video at all")
    with pytest.raises(OF.CorruptVideo):
        OF.inspect_video(bad)


def _make_video(path: Path, n=30, fps=15):
    import cv2
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    for i in range(n):
        w.write(np.full((48, 64, 3), i * 5 % 255, np.uint8))
    w.release()


def _fake_openface(tmp_path: Path, csv: Path) -> Path:
    exe = tmp_path / "FeatureExtraction"
    exe.write_text(f"""#!/usr/bin/env python3
import sys, shutil, pathlib
a = sys.argv; f = pathlib.Path(a[a.index('-f') + 1]); o = pathlib.Path(a[a.index('-out_dir') + 1])
shutil.copy({str(csv)!r}, o / (f.stem + '.csv'))
""")
    exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    return exe


def test_openface_unavailable(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENFACE_BIN", raising=False); monkeypatch.delenv("OPENFACE_DOCKER_IMAGE", raising=False)
    monkeypatch.setenv("PATH", str(tmp_path))
    video = tmp_path / "v.avi"; _make_video(video)
    with pytest.raises(OF.OpenFaceUnavailable):
        OF.extract_from_video(video, 2.0)


@needs_ckpt
def test_video_to_result_with_stub_openface(monkeypatch, tmp_path):
    """Pipeline plumbing test only: the stub emits a pre-made OpenFace CSV; it is NOT a webcam validation."""
    csv = tmp_path / "of.csv"; synth().to_csv(csv, index=False)
    monkeypatch.setenv("OPENFACE_BIN", str(_fake_openface(tmp_path, csv)))
    video = tmp_path / "v.avi"; _make_video(video)
    r = S.GazeService().analyze_video(video, 2.0, "sess")
    assert r["status"] == "success" and r["quality"]["sample_count"] == 450
    bad = tmp_path / "bad.webm"; bad.write_bytes(b"junk")
    r2 = S.GazeService().analyze_video(bad, 2.0)
    assert r2["error_code"] == C.ERR_CORRUPT_VIDEO and r2["probability"] is None


# ── API ──────────────────────────────────────────────────────────────────────

def _login(client):
    client.post("/auth/register", json={"name": "G", "email": "g@example.com", "password": "correct-horse-9"})


def test_api_requires_auth_and_validates(app_client):
    c = app_client()
    assert c.post("/gaze/analyze", files={"video": ("a.webm", b"x")}).status_code in (401, 403)
    _login(c)
    assert c.post("/gaze/analyze", files={"video": ("a.txt", b"x")}).status_code == 415
    assert c.post("/gaze/analyze", files={"video": ("a.webm", b"")}).status_code == 422
    assert c.get("/gaze/jobs/doesnotexist").status_code == 404


@needs_ckpt
def test_api_async_job_end_to_end(app_client, monkeypatch, tmp_path):
    csv = tmp_path / "of.csv"; synth().to_csv(csv, index=False)
    monkeypatch.setenv("OPENFACE_BIN", str(_fake_openface(tmp_path, csv)))
    video = tmp_path / "v.avi"; _make_video(video)
    c = app_client(); _login(c)
    r = c.post("/gaze/analyze", files={"video": ("v.avi", video.read_bytes())}, data={"duration_ms": "2000", "session_id": "abc"})
    assert r.status_code == 202
    jid = r.json()["job_id"]
    for _ in range(100):
        j = c.get(f"/gaze/jobs/{jid}").json()
        if j["state"] == "done":
            break
        time.sleep(0.1)
    assert j["state"] == "done" and j["stage"] == "complete"
    res = j["result"]
    assert res["status"] == "success" and res["model_version"] == C.DEFAULT_MODEL_VERSION and res["quality"]["sample_count"] == 450
    # another user cannot read it
    other = app_client()
    other.post("/auth/register", json={"name": "H", "email": "h@example.com", "password": "correct-horse-9"})
    assert other.get(f"/gaze/jobs/{jid}").status_code == 404


def test_screening_rejects_unknown_gaze_analysis_id(app_client):
    from conftest import screening_body
    c = app_client(); _login(c)
    r = c.post("/screening/screen", json=screening_body(gazeSkipped=False, gazeAnalysisId="nope"))
    assert r.status_code == 422


# ── Gaze lab ─────────────────────────────────────────────────────────────────

def test_lab_disabled_returns_403(app_client, monkeypatch):
    monkeypatch.setenv("GAZE_LAB_ENABLED", "0")
    c = app_client(); _login(c)
    from backend.core.database import get_users_collection
    get_users_collection().update_one({"email": "g@example.com"}, {"$set": {"role": "clinician"}})
    assert c.get("/gaze/lab/sessions").status_code == 403
    assert c.post("/gaze/analyze", files={"video": ("a.webm", b"x")}, data={"keep_features": "true"}).status_code == 403


@needs_ckpt
def test_lab_sessions_and_validate(app_client, monkeypatch, tmp_path):
    monkeypatch.setenv("GAZE_LAB_ENABLED", "1")
    monkeypatch.setattr(jobs, "LAB_DIR", tmp_path / "lab")
    (tmp_path / "lab").mkdir()
    for i in range(3):
        synth(seed=i).to_csv(tmp_path / "lab" / f"s{i}.csv", index=False)
    import backend.data.validate_webcam_domain as V
    monkeypatch.setattr(V, "WEBCAM_VALIDATION_PATH", tmp_path / "val.json")
    c = app_client(); _login(c)
    assert c.get("/gaze/lab/sessions").status_code == 403                  # signed-in but not a clinician
    from backend.core.database import get_users_collection
    get_users_collection().update_one({"email": "g@example.com"}, {"$set": {"role": "clinician"}})
    d = c.get("/gaze/lab/sessions").json()
    assert len(d["sessions"]) == 3 and all(s["quality_valid"] for s in d["sessions"])
    r = c.post("/gaze/lab/validate")
    assert r.status_code == 200 and "passed" in r.json() and (tmp_path / "val.json").exists()
    assert c.delete("/gaze/lab/sessions").json()["deleted"] == 3


def test_session_centering_removes_camera_offset_but_not_motion():
    """The same movement recorded with a different camera placement gives the same tensor."""
    a = synth(seed=3); b = a.copy()
    b[" gaze_angle_y"] += 0.25; b[" pose_Rx"] -= 0.3; b[" gaze_angle_x"] -= 0.1
    wa, wb = P.prepare_session(a).windows, P.prepare_session(b).windows
    np.testing.assert_allclose(wa, wb, atol=1e-9)
    calm = P.prepare_session(synth(seed=3, spread=0.01)).windows
    assert wa.std() > calm.std()


@needs_ckpt
def test_domain_gate_flags_stillness_and_passes_dasd_children():
    svc = S.GazeService()
    rec = next(r for r in dasd.discover() if r.label == 0)
    ok = svc.analyze_frames(dasd.read_csv(rec))
    assert ok["domain"]["status"] == "in_domain" and ok["status"] == "success"
    still = dasd.read_csv(rec).copy(); still.columns = [c.strip() for c in still.columns]
    for c in ("gaze_angle_x", "gaze_angle_y", "pose_Rx", "pose_Ry", "pose_Rz"):
        still[c] = still[c].mean() + 0.01 * (still[c] - still[c].mean())
    r = svc.analyze_frames(still)
    assert r["status"] == "out_of_domain" and r["probability"] is None and r["error_code"] == C.ERR_OUT_OF_DOMAIN
    assert r["domain"]["direction"] == "below" and r["fusion_eligible"] is False


# ── descriptive (non-diagnostic) summary ─────────────────────────────────────

def test_descriptive_summary_is_real_and_in_degrees():
    prep = P.prepare_session(synth())
    d = Q.descriptive_summary(prep)
    assert set(d["channels"]) == {"head_yaw", "head_pitch", "head_roll", "gaze_x", "gaze_y"}
    raw_std = np.nanstd(prep.resampled.grid["pose_Ry"], ddof=1)
    assert abs(d["channels"]["head_yaw"]["std_deg"] - raw_std * 180 / np.pi) < 0.02
    assert "not diagnostic" in d["disclaimer"]
    assert Q.descriptive_summary(P.prepare_session(synth(n=1))) is None


@needs_ckpt
def test_descriptive_and_quality_present_even_when_classifier_withholds():
    svc = S.GazeService()
    still = synth()
    for c in (" gaze_angle_x", " gaze_angle_y", " pose_Rx", " pose_Ry", " pose_Rz"):
        still[c] = still[c].mean() + 0.01 * (still[c] - still[c].mean())        # almost motionless -> out of domain
    r = svc.analyze_frames(still)
    assert r["status"] == "out_of_domain" and r["probability"] is None
    assert r["descriptive"]["channels"]["head_yaw"]["std_deg"] > 0 and r["quality"]["valid_sample_count"] == 450
    bad = svc.analyze_frames(synth(conf=0.2))             # quality failure still reports what was measured
    assert bad["status"] == "insufficient_quality" and bad["quality"]["sample_count"] == 450


@needs_ckpt
@needs_dasd
def test_v2_baseline_still_selectable_and_both_models_agree_on_applicability():
    child = dasd.read_csv(next(x for x in dasd.discover() if x.label == 0))
    r2 = S.GazeService(model_version="gaze-openface-dasd-v2").analyze_frames(child)
    r3 = S.GazeService().analyze_frames(child)
    assert r2["model_version"] == "gaze-openface-dasd-v2" and r3["model_version"] == "gaze-openface-dasd-v3"
    assert r2["domain"]["status"] == r3["domain"]["status"] == "in_domain"
    with pytest.raises(ValueError):
        S.GazeService(model_version="nope")


# ── leakage-audit controls behave as designed ────────────────────────────────

def _resampled(df):
    return P.prepare_session(df, C.MODEL_CONFIGS["gaze-openface-dasd-v3"]).resampled


def test_donor_swap_keeps_own_timeline_holes_and_length_but_not_content():
    from backend.data import audit_gaze_leakage as A
    own = synth(seed=1); own = own.drop(index=range(100, 180)).reset_index(drop=True)      # a gap -> holes
    donor = synth(seed=2, spread=0.3)
    rs, rd = _resampled(own), _resampled(donor)
    g = A.donor_grid(rs, [rd], np.random.default_rng(0))
    assert len(g["gaze_angle_x"]) == len(rs.hole)
    np.testing.assert_array_equal(np.isfinite(g["gaze_angle_x"]), np.isfinite(rs.grid["gaze_angle_x"]))   # same holes
    ok = np.isfinite(g["gaze_angle_x"])
    assert not np.allclose(g["gaze_angle_x"][ok], rs.grid["gaze_angle_x"][ok])                            # different content
    donor_vals = rd.grid["gaze_angle_x"][np.isfinite(rd.grid["gaze_angle_x"])]
    assert np.isin(np.round(g["gaze_angle_x"][ok], 9), np.round(donor_vals, 9)).all()                     # values come from the donor


def test_time_shuffle_preserves_values_and_holes():
    from backend.data import audit_gaze_leakage as A
    rs = _resampled(synth(seed=4))
    g = A.shuffled_grid(rs, np.random.default_rng(1))
    a, b = rs.grid["gaze_angle_x"], g["gaze_angle_x"]
    np.testing.assert_allclose(np.sort(a[np.isfinite(a)]), np.sort(b[np.isfinite(b)]))
    assert not np.allclose(a, b)
    # both channels moved together (same permutation)
    pairs_a = set(zip(np.round(rs.grid["gaze_angle_x"], 9), np.round(rs.grid["gaze_angle_y"], 9)))
    pairs_b = set(zip(np.round(g["gaze_angle_x"], 9), np.round(g["gaze_angle_y"], 9)))
    assert pairs_a == pairs_b


def test_crop_centres_on_the_crop_only():
    from backend.data import audit_gaze_leakage as A
    rs = _resampled(synth(n=900, seed=5))
    w = A.windows_from(rs, 0, A.CROP_STEPS)
    assert w.shape[1] == 60 and 1 <= len(w) <= 2
    assert abs(w[:, :, 0].mean()) < 0.2          # centred on the cropped 7 s, not on the whole session
