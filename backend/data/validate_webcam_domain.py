"""Compare NeuroSense webcam OpenFace features with the DASD training features and decide whether
the model may enter fusion.

    python -m backend.data.validate_webcam_domain --csv-dir <folder of OpenFace CSVs from webcam recordings>

The CSVs must come from the real NeuroSense flow (browser recording -> server OpenFace run; keep
them by running OpenFace on the recordings with the flags in ml/gaze/config.OPENFACE_FLAGS).
This is a TECHNICAL pipeline check.  Volunteer recordings without ASD/TD ground truth say nothing
about clinical accuracy.  Pass/fail criteria are fixed here, before any webcam data is seen:

  * >= MIN_SESSIONS recordings and >= 80% of them pass the quality gate
  * mean OpenFace confidence >= 0.85, missing rate per feature <= 5%
  * per feature: |mean_webcam - mean_DASD| <= 1.0 DASD std  and  0.33 <= std_webcam/std_DASD <= 3.0

On success writes backend/models/gaze_openface_webcam_validation.json, which unlocks fusion.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402
from backend.ml.gaze import quality as Q  # noqa: E402
from backend.ml.gaze.service import WEBCAM_VALIDATION_PATH  # noqa: E402

MIN_SESSIONS = 3
MAX_MEAN_SHIFT_SD = 1.0
STD_RATIO = (0.33, 3.0)
MAX_MISSING = 0.05
MIN_MEAN_CONF = 0.85
REPORTS = Path(__file__).resolve().parents[1] / "reports"


def frame_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per-frame canonical features after the SHARED cleaning (position + head pose; velocity from the grid)."""
    prep = P.prepare_session(df)
    cl = prep.cleaned
    out = pd.DataFrame({"gaze_angle_x": cl.values["gaze_angle_x"], "gaze_angle_y": cl.values["gaze_angle_y"],
                        "head_pose_x": cl.values["pose_Rx"], "head_pose_y": cl.values["pose_Ry"],
                        "head_pose_z": cl.values["pose_Rz"], "confidence": cl.confidence})
    return out


def collect(paths) -> tuple[pd.DataFrame, list[dict], float]:
    frames, sessions = [], []
    for p in paths:
        raw = pd.read_csv(p)
        prep = P.prepare_session(raw); q = Q.assess(prep)
        sessions.append({"file": Path(p).name, "quality_valid": q.valid, "reason": q.reason,
                         "valid_sample_ratio": q.valid_sample_ratio, "mean_confidence": q.mean_confidence,
                         "windows": q.window_count, "duration_s": q.duration_seconds,
                         "frames_total": q.sample_count, "frames_valid": q.valid_sample_count})
        frames.append(frame_features(raw))
    missing = float(np.mean([1 - s["frames_valid"] / max(1, s["frames_total"]) for s in sessions])) if sessions else 1.0
    return (pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()), sessions, missing


def plot(dasd_df, web_df, path):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cols = list(web_df.columns)
    fig, axs = plt.subplots(2, 3, figsize=(11, 6))
    for ax, c in zip(axs.ravel(), cols):
        lo, hi = np.percentile(np.r_[dasd_df[c], web_df[c]], [0.5, 99.5])
        ax.hist(dasd_df[c], bins=50, range=(lo, hi), alpha=.55, density=True, label="DASD")
        ax.hist(web_df[c], bins=50, range=(lo, hi), alpha=.55, density=True, label="webcam")
        ax.set_title(c, fontsize=9)
    axs[0, 0].legend(); fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def main(argv=None) -> dict:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=WEBCAM_VALIDATION_PATH)
    ap.add_argument("--allow-dasd", action="store_true", help="pipeline self-test with DASD files (never writes the real file)")
    a = ap.parse_args(argv)
    if dasd.DASD_ROOT in a.csv_dir.resolve().parents or a.csv_dir.resolve() == dasd.DASD_ROOT:
        if not a.allow_dasd or a.out == WEBCAM_VALIDATION_PATH:
            sys.exit("refusing: DASD files are not webcam recordings (use --allow-dasd with a different --out)")
    files = sorted(a.csv_dir.glob("*.csv"))
    web, sessions, _ = collect(files)
    dd = pd.concat([frame_features(dasd.read_csv(r)) for r in dasd.discover()], ignore_index=True)
    rows, ok_all = [], True
    for c in [c for c in web.columns if c != "confidence"]:
        mu_d, sd_d = dd[c].mean(), dd[c].std()
        mu_w, sd_w = (web[c].mean(), web[c].std()) if len(web) else (np.nan, np.nan)
        shift = abs(mu_w - mu_d) / sd_d if sd_d else np.inf
        ratio = sd_w / sd_d if sd_d else np.inf
        ok = bool(shift <= MAX_MEAN_SHIFT_SD and STD_RATIO[0] <= ratio <= STD_RATIO[1])
        ok_all &= ok
        rows.append({"feature": c, "dasd_mean": mu_d, "dasd_std": sd_d, "dasd_min": dd[c].min(), "dasd_max": dd[c].max(),
                     "webcam_mean": mu_w, "webcam_std": sd_w, "webcam_min": web[c].min() if len(web) else None,
                     "webcam_max": web[c].max() if len(web) else None, "mean_shift_in_dasd_sd": shift,
                     "std_ratio": ratio, "pass": ok})
    pass_ratio = np.mean([s["quality_valid"] for s in sessions]) if sessions else 0.0
    miss = float(np.mean([1 - s["frames_valid"] / max(1, s["frames_total"]) for s in sessions])) if sessions else 1.0
    mean_conf = float(web["confidence"].mean()) if len(web) else 0.0
    checks = {"enough_sessions": len(sessions) >= MIN_SESSIONS, "quality_gate_pass_ratio>=0.8": bool(pass_ratio >= 0.8),
              "mean_confidence>=0.85": bool(mean_conf >= MIN_MEAN_CONF), "rejected_frame_rate<=5%": bool(miss <= MAX_MISSING),
              "feature_distributions": bool(ok_all)}
    passed = all(checks.values())
    result = {"passed": passed, "checked_at": datetime.now(timezone.utc).isoformat(), "n_sessions": len(sessions),
              "checks": checks, "features": rows, "sessions": sessions, "mean_confidence": mean_conf,
              "mean_rejected_frame_rate": miss, "model_version": C.MODEL_VERSION,
              "scope": "technical pipeline validation only; no ASD/TD ground truth, not clinical evidence",
              "reason": None if passed else "failed: " + ", ".join(k for k, v in checks.items() if not v)}
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "gaze_domain_check.json").write_text(json.dumps(result, indent=2, default=float))
    if len(web):
        plot(dd[web.columns], web, REPORTS / "gaze_domain_check.png")
    a.out.write_text(json.dumps(result, indent=2, default=float))
    print(json.dumps({k: result[k] for k in ("passed", "n_sessions", "checks", "reason")}, indent=1))
    for r in rows:
        print(f"{r['feature']:14s} DASD {r['dasd_mean']:+.3f}±{r['dasd_std']:.3f}  webcam {r['webcam_mean']:+.3f}±{r['webcam_std']:.3f}  shift {r['mean_shift_in_dasd_sd']:.2f}sd  ratio {r['std_ratio']:.2f}  {'ok' if r['pass'] else 'FAIL'}")
    return result


if __name__ == "__main__":
    main()
