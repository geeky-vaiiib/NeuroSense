"""Descriptive diagnosis of the DASD -> webcam domain shift (no model training, no thresholds changed).

    python -m backend.data.diagnose_gaze_domain [--csv-dir backend/data/webcam_validation]

Writes backend/reports/domain_diagnosis/{stats.json, feature_stats.csv, session_stats.csv, *.png}.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports" / "domain_diagnosis"
FEATS = ["gaze_angle_x", "gaze_angle_y", "gaze_vel_x", "gaze_vel_y", "head_pose_x", "head_pose_y", "head_pose_z"]
CFG = C.PreprocessConfig(feature_names=tuple(FEATS))


def session_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Per-step features on the 10 Hz grid exactly as the model pipeline builds them (holes dropped)."""
    prep = P.prepare_session(df, CFG)
    f = P.build_features(prep.resampled, CFG)
    ok = np.isfinite(f).all(axis=1)
    return pd.DataFrame(f[ok], columns=FEATS)


def stats(x: pd.Series, n_total: int) -> dict:
    v = x.dropna().to_numpy(float)
    q = np.percentile(v, [1, 5, 25, 50, 75, 95, 99])
    return {"mean": v.mean(), "std": v.std(ddof=1), "median": q[3], "min": v.min(), "max": v.max(),
            "p01": q[0], "p05": q[1], "p25": q[2], "p50": q[3], "p75": q[4], "p95": q[5], "p99": q[6],
            "iqr": q[4] - q[2], "valid_n": len(v), "missing_n": n_total - len(v)}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", type=Path, default=Path(__file__).parent / "webcam_validation")
    a = ap.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    recs = dasd.discover()
    raw_d = {r.participant_id: dasd.read_csv(r) for r in recs}
    web_files = sorted(a.csv_dir.glob("*.csv"))
    raw_w = {f.stem[:8]: pd.read_csv(f) for f in web_files}
    rep: dict = {}

    # 1 ── pipeline comparison ------------------------------------------------
    d0 = next(iter(raw_d.values())); w0 = next(iter(raw_w.values()))
    dcols = [c.strip() for c in d0.columns]; wcols = [c.strip() for c in w0.columns]
    def meta(df):
        df = df.copy(); df.columns = [c.strip() for c in df.columns]
        t = df.timestamp.to_numpy(float); dt = np.diff(t)
        return {"rows": len(df), "fps": round((len(df) - 1) / (t[-1] - t[0]), 2), "dt_median_s": round(float(np.median(dt)), 4),
                "dt_max_s": round(float(dt.max()), 3), "first_timestamp": float(t[0]), "success_mean": float(df.success.mean()),
                "confidence_mean": float(df.confidence.mean()), "confidence_cap": float(df.confidence.max())}
    rep["pipeline"] = {
        "openface_dasd": "OpenFace 2.0 (README); full output incl. AUs and 68 landmarks",
        "openface_webcam": "algebr/openface docker image (OpenFace 2.x build), flags " + " ".join(C.OPENFACE_FLAGS),
        "dasd_columns": len(dcols), "webcam_columns": len(wcols),
        "webcam_columns_missing_in_dasd": [c for c in wcols if c not in dcols],
        "shared_columns_same_order": [c for c in dcols if c in wcols] == wcols,
        "timestamp_units": "seconds in both (frame/fps)",
        "dasd_example": meta(d0), "webcam_example": meta(w0),
        "dasd_fps_range": [min(meta(d)["fps"] for d in raw_d.values()), max(meta(d)["fps"] for d in raw_d.values())],
        "webcam_fps": [meta(d)["fps"] for d in raw_w.values()],
        "camera_intrinsics": "OpenFace defaults (fx=fy=500*(w/640)) unless -fx given; not recorded for DASD, default in webcam run",
        "success_filter": "DASD CSVs contain only success==1 rows (pre-filtered); webcam rows are kept and filtered by clean_frames",
        "dup_rows_dasd": float(np.mean([(np.abs(np.diff(P.standardize_frame(d)[["gaze_angle_x", "gaze_angle_y"]].values, axis=0)).sum(1) == 0).mean() for d in raw_d.values()])),
        "dup_rows_webcam": [float((np.abs(np.diff(P.standardize_frame(d)[["gaze_angle_x", "gaze_angle_y"]].values, axis=0)).sum(1) == 0).mean()) for d in raw_w.values()],
    }

    # 2 ── distributions ------------------------------------------------------
    frames_d = {k: session_frame(v) for k, v in raw_d.items()}
    frames_w = {k: session_frame(v) for k, v in raw_w.items()}
    pooled_d = pd.concat(frames_d.values(), ignore_index=True); pooled_w = pd.concat(frames_w.values(), ignore_index=True)
    rows = []
    for f in FEATS:
        rows.append({"feature": f, "group": "DASD pooled", **stats(pooled_d[f], len(pooled_d))})
        rows.append({"feature": f, "group": "webcam pooled", **stats(pooled_w[f], len(pooled_w))})
        for k, df in frames_w.items():
            rows.append({"feature": f, "group": f"webcam {k}", **stats(df[f], len(df))})
    fs = pd.DataFrame(rows); fs.to_csv(OUT / "feature_stats.csv", index=False)

    # per-session table (DASD per child + webcam), mean/std/IQR/range per feature
    srows = []
    labels = {r.participant_id: dasd.LABEL_NAMES[r.label] for r in recs}
    for grp, fr in (("DASD", frames_d), ("webcam", frames_w)):
        for k, df in fr.items():
            row = {"group": grp, "id": k, "label": labels.get(k, "unlabelled"), "n": len(df)}
            for f in FEATS:
                row[f + "_mean"] = df[f].mean(); row[f + "_std"] = df[f].std(); row[f + "_iqr"] = df[f].quantile(.75) - df[f].quantile(.25)
                row[f + "_range"] = df[f].max() - df[f].min()
            srows.append(row)
    ss = pd.DataFrame(srows); ss.to_csv(OUT / "session_stats.csv", index=False)

    # 3 ── is the gap between-subject / scale / coordinate? -------------------
    d_ss = ss[ss.group == "DASD"]; w_ss = ss[ss.group == "webcam"]
    pct = {}
    for c in [c for c in ss.columns if c.endswith(("_mean", "_std", "_iqr"))]:
        pct[c] = {"dasd_min": float(d_ss[c].min()), "dasd_median": float(d_ss[c].median()), "dasd_max": float(d_ss[c].max()),
                  "webcam": [round(float(v), 4) for v in w_ss[c]],
                  "webcam_pctl_in_dasd": [round(float((d_ss[c] < v).mean() * 100)) for v in w_ss[c]],
                  "webcam_inside_dasd_range": [bool(d_ss[c].min() <= v <= d_ss[c].max()) for v in w_ss[c]]}
    rep["per_session_position"] = pct
    # decomposition of DASD gaze vs head pose
    cat = pd.concat([P.standardize_frame(v) for v in raw_d.values()])
    rep["gaze_head_coupling"] = {
        "dasd_r_gx_Ry": float(np.corrcoef(cat.gaze_angle_x, cat.pose_Ry)[0, 1]),
        "dasd_r_gy_Rx": float(np.corrcoef(cat.gaze_angle_y, cat.pose_Rx)[0, 1]),
        "dasd_slope_gx_Ry": float(np.polyfit(cat.pose_Ry, cat.gaze_angle_x, 1)[0]),
        "dasd_slope_gy_Rx": float(np.polyfit(cat.pose_Rx, cat.gaze_angle_y, 1)[0]),
        "dasd_per_child_r_gx_Ry_median": float(np.median([np.corrcoef(P.standardize_frame(v).gaze_angle_x, P.standardize_frame(v).pose_Ry)[0, 1] for v in raw_d.values()])),
        "webcam_r_gx_Ry": [float(np.corrcoef(*P.standardize_frame(v)[["gaze_angle_x", "pose_Ry"]].values.T)[0, 1]) for v in raw_w.values()],
        "webcam_r_gy_Rx": [float(np.corrcoef(*P.standardize_frame(v)[["gaze_angle_y", "pose_Rx"]].values.T)[0, 1]) for v in raw_w.values()],
    }
    sx, sy = C.DEPLOYED.head_slopes
    def resid(df):
        s = P.standardize_frame(df); return (s.gaze_angle_x - sx * s.pose_Ry).std(), (s.gaze_angle_y - sy * s.pose_Rx).std()
    rd = np.array([resid(v) for v in raw_d.values()]); rw = np.array([resid(v) for v in raw_w.values()])
    rep["eye_in_head_residual_std"] = {"dasd_pctl_0_5_50_95_100_x": np.percentile(rd[:, 0], [0, 5, 50, 95, 100]).round(3).tolist(),
                                       "dasd_pctl_0_5_50_95_100_y": np.percentile(rd[:, 1], [0, 5, 50, 95, 100]).round(3).tolist(),
                                       "webcam_x": rw[:, 0].round(3).tolist(), "webcam_y": rw[:, 1].round(3).tolist()}
    rep["distance_and_geometry"] = {
        "pose_Tz_mm_dasd_pctl_5_50_95": np.percentile([P.standardize_frame(v).pipe(lambda s: v.rename(columns=str.strip)["pose_Tz"].mean()) for v in raw_d.values()], [5, 50, 95]).round(0).tolist(),
        "pose_Tz_mm_webcam": [round(float(v.rename(columns=str.strip)["pose_Tz"].mean()), 0) for v in raw_w.values()]}

    # 4 ── velocity consistency ------------------------------------------------
    def vel_stats(df):
        s = df.rename(columns=str.strip); t = s.timestamp.to_numpy(float); g = s.gaze_angle_x.to_numpy(float)
        raw_v = np.abs(np.diff(g) / np.diff(t))
        fr = session_frame(df)
        return {"raw_frame_median_abs": float(np.median(raw_v)), "raw_frame_p95_abs": float(np.percentile(raw_v, 95)),
                "grid10hz_median_abs": float(np.median(np.abs(fr.gaze_vel_x))), "grid10hz_p95_abs": float(np.percentile(np.abs(fr.gaze_vel_x), 95))}
    vd = pd.DataFrame([vel_stats(v) for v in raw_d.values()]); vw = pd.DataFrame([vel_stats(v) for v in raw_w.values()])
    rep["velocity_check"] = {
        "definition": "gaze_vel = diff(gaze_angle on the 10 Hz grid) * 10 [rad/s]; grid = linear interpolation of cleaned OpenFace frames (point sampling, no smoothing)",
        "timestamp_units_match": True,
        "dasd_median_over_children": vd.median().round(4).to_dict(), "webcam_per_session": vw.round(4).to_dict(orient="list"),
        "note": "ratio grid/raw median shows aliasing/interpolation effect; webcam fps 30 vs DASD ~20-25"}

    # plots ------------------------------------------------------------------
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cols = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    fig, axs = plt.subplots(2, 4, figsize=(17, 7))
    for ax, f in zip(axs.ravel(), FEATS):
        lo, hi = np.percentile(np.r_[pooled_d[f], pooled_w[f]], [0.5, 99.5]); bins = np.linspace(lo, hi, 70)
        ax.hist(pooled_d[f], bins, density=True, alpha=.45, color="gray", label="DASD pooled")
        ax.hist(pooled_w[f], bins, density=True, histtype="step", lw=2.2, color="k", label="webcam pooled")
        for i, (k, df) in enumerate(frames_w.items()):
            ax.hist(df[f], bins, density=True, histtype="step", lw=1.2, color=cols[i], label=f"webcam {k[:4]}")
        ax.set_title(f, fontsize=10); ax.set_yscale("log")
    axs.ravel()[0].legend(fontsize=7); axs.ravel()[-1].axis("off")
    fig.tight_layout(); fig.savefig(OUT / "feature_histograms.png", dpi=130); plt.close(fig)

    fig, axs = plt.subplots(2, 3, figsize=(15, 8))
    for ax, f in zip(axs.ravel(), ["gaze_angle_x", "gaze_angle_y", "head_pose_x", "head_pose_y", "head_pose_z", "gaze_vel_x"]):
        for lab, colr in (("ASD", "tab:red"), ("TD", "tab:blue")):
            m = d_ss.label == lab; ax.scatter(d_ss[m][f + "_mean"], d_ss[m][f + "_std"], s=22, alpha=.7, c=colr, label=f"DASD {lab}")
        ax.scatter(w_ss[f + "_mean"], w_ss[f + "_std"], s=90, marker="*", c="k", label="webcam sessions")
        ax.set_xlabel(f + " session mean"); ax.set_ylabel("session std"); ax.set_yscale("log"); ax.set_title(f, fontsize=10)
    axs[0, 0].legend(fontsize=8); fig.tight_layout(); fig.savefig(OUT / "per_session_mean_vs_std.png", dpi=130); plt.close(fig)

    fig, ax = plt.subplots(1, 2, figsize=(11, 4.5))
    ax[0].scatter(cat.pose_Ry[::20], cat.gaze_angle_x[::20], s=2, alpha=.3, label="DASD")
    for i, v in enumerate(raw_w.values()):
        s = P.standardize_frame(v); ax[0].scatter(s.pose_Ry[::10], s.gaze_angle_x[::10], s=3, color=cols[i + 1])
    ax[0].set_xlabel("head yaw (pose_Ry)"); ax[0].set_ylabel("gaze_angle_x"); ax[0].set_title("gaze_x is mostly head yaw in DASD")
    ax[1].scatter(cat.pose_Rx[::20], cat.gaze_angle_y[::20], s=2, alpha=.3)
    for i, v in enumerate(raw_w.values()):
        s = P.standardize_frame(v); ax[1].scatter(s.pose_Rx[::10], s.gaze_angle_y[::10], s=3, color=cols[i + 1])
    ax[1].set_xlabel("head pitch (pose_Rx)"); ax[1].set_ylabel("gaze_angle_y")
    fig.tight_layout(); fig.savefig(OUT / "gaze_vs_head_pose.png", dpi=130); plt.close(fig)

    (OUT / "stats.json").write_text(json.dumps(rep, indent=1, default=float))
    return rep


if __name__ == "__main__":
    r = main()
    print(json.dumps({k: r[k] for k in ("pipeline", "gaze_head_coupling", "eye_in_head_residual_std", "distance_and_geometry", "velocity_check")}, indent=1, default=float))
