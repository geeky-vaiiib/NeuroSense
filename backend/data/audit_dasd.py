"""Dataset audit for DASD (run before training).  Writes backend/reports/dasd_audit.{json,md}."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports"


def main() -> dict:
    recs = dasd.discover()
    counts = dasd.validate_labels(recs)
    rows, col_missing, first_cols = [], {}, None
    for r in recs:
        raw = dasd.read_csv(r)
        d = raw.copy(); d.columns = [c.strip() for c in d.columns]
        first_cols = first_cols or list(d.columns)
        ts = d["timestamp"].to_numpy(float)
        dur = float(ts[-1] - ts[0])
        rows.append(dict(
            id=r.participant_id, label=dasd.LABEL_NAMES[r.label], split=r.official_split,
            frames=len(d), duration_s=dur, fps=(len(d) - 1) / dur if dur > 0 else np.nan,
            success=float(d["success"].mean()), confidence=float(d["confidence"].mean()),
            gap_ratio=float((np.diff(ts) > C.MAX_GAP_S).mean()), nan_cells=int(d.isna().sum().sum()),
            cells=int(d.size)))
        for c in ("gaze_angle_x", "gaze_angle_y", "confidence", "pose_Rx", "pose_Ry", "pose_Rz", "pose_Tz"):
            col_missing.setdefault(c, []).append(float(d[c].isna().mean()))
    df = pd.DataFrame(rows)
    g = df.groupby("label").agg(participants=("id", "count"), frames=("frames", "sum"),
                                dur_mean=("duration_s", "mean"), dur_min=("duration_s", "min"),
                                dur_max=("duration_s", "max"), fps_mean=("fps", "mean"),
                                conf_mean=("confidence", "mean"), success_mean=("success", "mean"))
    from sklearn.metrics import roc_auc_score
    dur_auc = float(roc_auc_score((df.label == "ASD").astype(int), df.duration_s))
    fps_auc = float(roc_auc_score((df.label == "ASD").astype(int), -df.fps))
    audit = {
        "dataset": "DASD (Cai et al., MICCAI 2022)", "root": str(dasd.DASD_ROOT),
        "participants": len(df), "asd": counts["ASD"], "td": counts["TD"],
        "recordings": len(df), "frames_total": int(df.frames.sum()),
        "official_split": df.groupby(["split", "label"]).size().unstack().to_dict(),
        "modalities": ["OpenFace 2.0 per-frame CSV features (no raw video, no audio, no images shipped)"],
        "n_columns": len(first_cols),
        "gaze_columns": [c for c in first_cols if c.startswith("gaze")],
        "head_pose_columns": [c for c in first_cols if c.startswith("pose_")],
        "other_column_groups": {"eye_lmk_*": "eye landmarks 2D/3D", "x_/y_/X_/Y_/Z_": "68 face landmarks",
                                "p_*": "PDM shape params", "AU*_r/_c": "action units"},
        "label_source": "ADOS-2 (README); folders abnormal=ASD(57) normal=TD(25); class_indices.json 0->abnormal 1->normal",
        "label_mapping": {"ASD": 1, "TD": 0},
        "filename_warning": "all files are named normal_<n>.csv, also inside abnormal/ -> labels come from folders only",
        "metadata_available": "none: no age, sex, ADOS score, stimulus id or session info",
        "stimulus_info": "NOT provided. README: children did the experiment at home with a parent; stimulus/task unknown",
        "missing_data_pct": {k: round(100 * float(np.mean(v)), 4) for k, v in col_missing.items()},
        "nan_cell_pct_overall": round(100 * df.nan_cells.sum() / df.cells.sum(), 5),
        "success_flag_mean": float(df.success.mean()),
        "note_success": "success==1 for every row: frames where OpenFace failed were already removed -> gaps are the only trace of lost tracking",
        "per_class": g.round(3).reset_index().to_dict(orient="records"),
        "CONFOUNDS": {
            "duration_only_AUC_ASD": round(dur_auc, 3),
            "fps_only_AUC_ASD": round(fps_auc, 3),
            "meaning": "recording length / frame rate alone separate the classes -> the model must see fixed-length windows on a fixed-rate grid",
        },
        "participant_unit": "one CSV = one child (README: 82 children = 82 files); official train/test split is by file",
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "dasd_audit.json").write_text(json.dumps(audit, indent=2, default=float))
    df.round(4).to_csv(OUT / "dasd_participants.csv", index=False)
    inv = ["| FEATURE | SOURCE | TYPE | USED FOR MODEL? |", "|---|---|---|---|",
           "| gaze_angle_x / gaze_angle_y | OpenFace gaze (radians, camera frame) | continuous | YES (+ derived velocity) |",
           "| gaze_0_*, gaze_1_* | OpenFace per-eye direction vectors | continuous | no (redundant with gaze_angle) |",
           "| confidence, success | OpenFace tracking | continuous / binary | quality gate only |",
           "| timestamp | OpenFace | seconds | resampling grid |",
           "| pose_Rx/Ry/Rz | OpenFace head rotation | continuous | candidate (selected by dev CV) |",
           "| pose_Tx/Ty/Tz | head translation / camera distance | continuous | NO (camera-distance confound) |",
           "| eye_lmk_*, x_/y_/X_/Y_/Z_, p_*, AU* | landmarks, shape, AUs | continuous | no |"]
    md = [f"# DASD audit\n", f"- Participants: **{audit['participants']}** (ASD {audit['asd']}, TD {audit['td']}); frames: {audit['frames_total']}",
          f"- Official split: {audit['official_split']}", f"- Labels: {audit['label_source']}", f"- {audit['filename_warning']}",
          f"- Metadata: {audit['metadata_available']}", f"- Stimulus: {audit['stimulus_info']}",
          f"- Missing data (% of rows NaN): {audit['missing_data_pct']}; success flag mean {audit['success_flag_mean']}",
          f"- {audit['note_success']}", "", "## Per class", "```\n" + g.round(3).to_string() + "\n```",
          "", f"## Confounds\n- duration-only AUC (ASD positive): **{audit['CONFOUNDS']['duration_only_AUC_ASD']}**; frame-rate-only AUC: {audit['CONFOUNDS']['fps_only_AUC_ASD']}",
          f"- {audit['CONFOUNDS']['meaning']}", "", "## Feature inventory", *inv]
    (OUT / "dasd_audit.md").write_text("\n".join(md))
    print("\n".join(md))
    return audit


if __name__ == "__main__":
    main()
