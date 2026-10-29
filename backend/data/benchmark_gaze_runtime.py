"""Runtime profile of the gaze pipeline, stage by stage, plus feature-equivalence checks for
resolution / frame-rate reductions.

    OPENFACE_DOCKER_IMAGE=algebr/openface python -m backend.data.benchmark_gaze_runtime --video-dir <dir>

--video-dir must contain synthetic moving-face videos named v<width>_<fps>.avi made from one face image
(no real recordings are kept by NeuroSense).  Equivalence results therefore describe the *extraction*
path (same face, same motion), not real-world behaviour.  Writes backend/reports/runtime_benchmark.json.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import inference as I  # noqa: E402
from backend.ml.gaze import openface as OF  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402
from backend.ml.gaze import quality as Q  # noqa: E402
from backend.ml.gaze.service import GazeService  # noqa: E402

DURATION_S = 30.0   # recorded duration passed to normalize_video
OUT = Path(__file__).resolve().parents[1] / "reports" / "runtime_benchmark.json"


def timed(fn):
    t = time.perf_counter(); r = fn(); return r, time.perf_counter() - t


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--video-dir", type=Path, required=True); ap.add_argument("--repeats", type=int, default=3)
    a = ap.parse_args()
    svc = GazeService(); res = {"openface_available": OF.is_available(), "stages": {}, "equivalence": {}}
    ref_video = a.video_dir / "v640_30.avi"
    # warm-up so Rosetta/docker caches are not charged to the stages
    with tempfile.TemporaryDirectory() as tmp:
        OF.run_openface(ref_video, Path(tmp))
    t_start = []
    for _ in range(3):
        _, dt = timed(lambda: subprocess.run(["docker", "run", "--rm", "--platform", "linux/amd64", "--entrypoint", "/bin/true", "algebr/openface"], capture_output=True))
        t_start.append(dt)
    res["docker_container_startup_s"] = float(np.median(t_start))
    rows = []
    for _ in range(a.repeats):
        row = {}
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp); norm = tmp / "r.avi"; out = tmp / "of"; out.mkdir()
            info, row["normalize_video_s"] = timed(lambda: OF.normalize_video(ref_video, norm, DURATION_S))
            csv, row["openface_s"] = timed(lambda: OF.run_openface(norm, out))
            df, row["parse_csv_s"] = timed(lambda: OF.parse_output(csv))
        prep, row["preprocess_s"] = timed(lambda: P.prepare_session(df, svc.cfg))
        _, row["quality_domain_s"] = timed(lambda: (Q.assess(prep), Q.domain_check(Q.domain_stats(prep, svc.cfg), svc.meta["domain_reference"])))
        wp, row["model_inference_s"] = timed(lambda: I.predict_windows(svc.model, prep.windows, svc.meta["normalization"]))
        _, row["explanation_ablation_s"] = timed(lambda: I.feature_ablation(svc.model, prep.windows, svc.meta["normalization"], svc.cfg.feature_names, float(wp.mean())))
        row["frames"] = info.frames; row["windows"] = int(len(prep.windows)); rows.append(row)
    keys = [k for k in rows[0] if k.endswith("_s")]
    res["stages"] = {k: {"median": float(np.median([r[k] for r in rows])), "all": [round(r[k], 4) for r in rows]} for k in keys}
    res["frames"] = rows[0]["frames"]; res["windows"] = rows[0]["windows"]
    res["per_frame_openface_ms"] = 1000 * res["stages"]["openface_s"]["median"] / res["frames"]
    res["python_cold_import_and_model_load_s"] = None
    # equivalence of reduced inputs vs the 640x480@30 reference, on the model's 10 Hz grid
    def grid(video, tmpdir):
        d = OF.parse_output(OF.run_openface(video, tmpdir)); prep = P.prepare_session(d, svc.cfg)
        f = P.build_features(prep.resampled, svc.cfg)
        return f, prep, d
    ref = None
    with tempfile.TemporaryDirectory() as tmp:
        for v in ("v640_30", "v480_30", "v320_30", "v640_15", "v640_10"):
            p = a.video_dir / f"{v}.avi"
            if not p.exists(): continue
            out = Path(tmp) / v; out.mkdir()
            (f, prep, d), dt = timed(lambda: grid(p, out))
            win = prep.windows
            prob = I.aggregate(I.predict_windows(svc.model, win, svc.meta["normalization"])) if len(win) else None
            e = {"openface_s": round(dt, 2), "frames": int(len(d)), "mean_confidence": float(d.rename(columns=str.strip).confidence.mean()),
                 "session_std": {n: float(np.nanstd(f[:, j])) for j, n in enumerate(svc.cfg.feature_names)}, "model_probability": prob}
            if ref is None:
                ref = f; e["role"] = "reference"
            else:
                n = min(len(ref), len(f)); r_, g_ = ref[:n], f[:n]; ok = np.isfinite(r_).all(1) & np.isfinite(g_).all(1)
                e["pearson_r_vs_ref"] = {nm: float(np.corrcoef(r_[ok, j], g_[ok, j])[0, 1]) for j, nm in enumerate(svc.cfg.feature_names)}
                e["mae_rad_vs_ref"] = {nm: float(np.mean(np.abs(r_[ok, j] - g_[ok, j]))) for j, nm in enumerate(svc.cfg.feature_names)}
                e["mae_over_dasd_median_std"] = {nm: float(np.mean(np.abs(r_[ok, j] - g_[ok, j])) / svc.meta["domain_reference"][nm]["median_std"]) for j, nm in enumerate(svc.cfg.feature_names)}
            res["equivalence"][v] = e
            print(v, json.dumps({k: e[k] for k in e if k in ("openface_s", "frames", "model_probability")}), flush=True)
    OUT.write_text(json.dumps(res, indent=1, default=float))
    print(json.dumps({"stages_median_s": {k: round(v["median"], 3) for k, v in res["stages"].items()}, "per_frame_openface_ms": round(res["per_frame_openface_ms"], 1), "docker_startup_s": round(res["docker_container_startup_s"], 2)}, indent=1))
    for v, e in res["equivalence"].items():
        if "pearson_r_vs_ref" in e: print(v, "r:", {k: round(x, 3) for k, x in e["pearson_r_vs_ref"].items()}, "| MAE/DASD-std:", {k: round(x, 3) for k, x in e["mae_over_dasd_median_std"].items()})


if __name__ == "__main__":
    main()
