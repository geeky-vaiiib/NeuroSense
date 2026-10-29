"""Train gaze-openface-dasd-v3 (BiLSTM, gaze_angle_x/y only, session-centred) as a NEW checkpoint.

    python -m backend.data.train_gaze_v3

Why this configuration: backend/reports/model_selection/model_comparison.json (pre-declared one-SE rule on
participant-level dev CV) found no BiLSTM feature set distinguishable from the v2 configuration and chose the
simplest.  Evidence reported for v3 is CROSS-VALIDATION ONLY:
  * dev CV (55 official-train children): epoch budget and headline numbers (see model_comparison.json)
  * supplementary CV on all 82 children (descriptive; the 27 official-test children were examined while
    v1/v2 were designed, so there is no untouched final test set and none is claimed)
The deployed checkpoint is then fit on all 82 children.  v2 files are never touched.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.data import train_gaze_openface_dasd as T  # noqa: E402
from backend.data.compare_gaze_models import metrics_from, oof_bilstm  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import model as M  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402
from backend.ml.gaze import quality as Q  # noqa: E402

VERSION = "gaze-openface-dasd-v3"
CFG = C.MODEL_CONFIGS[VERSION]
SEEDS = tuple(range(101, 111))


def main():
    recs = dasd.discover(); dasd.validate_labels(recs)
    dev, _ = dasd.official_split(recs)
    ck, mk = M.REGISTRY[VERSION]
    assert ck.name != "gaze_openface_dasd.pt", "refusing to write the frozen v2 checkpoint"

    d_dev = T.load_windows(dev, CFG)
    folds = [f for sd in T.CV_SEEDS for f in T.cross_validate(d_dev, dev, CFG, sd)]
    epochs = int(np.median([f["best_epoch"] for f in folds]))
    print(f"dev CV best-epoch median = {epochs}")

    d_all = T.load_windows(recs, CFG)
    labels = {r.participant_id: r.label for r in recs}
    reps = [metrics_from(oof_bilstm(d_all, recs, CFG, sd), labels) for sd in SEEDS]
    sup = {m: {"mean": float(np.mean([r[m] for r in reps])), "sd_repeats": float(np.std([r[m] for r in reps]))}
           for m in ("auc", "acc", "sens", "spec")}
    print("supplementary CV on all 82:", {k: round(v["mean"], 3) for k, v in sup.items()})

    cmp = json.loads((Path(__file__).resolve().parents[1] / "reports" / "model_selection" / "model_comparison.json").read_text())
    dev_res = cmp["results"]["BiLSTM / gaze-only"]

    model, norm, hist, _ = T.fit(d_all, recs, CFG, T.SEED, val_recs=None, epochs=epochs)
    stats = [Q.domain_stats(P.prepare_session(dasd.read_csv(r), CFG), CFG) for r in recs]
    ref = Q.domain_reference(stats)
    flags = [Q.domain_check(s, ref)["status"] for s in stats]
    gate = {"z_in": C.DOMAIN_Z_IN, "z_out": C.DOMAIN_Z_OUT, "children": len(flags),
            "in_domain": flags.count("in_domain") / len(flags), "marginal": flags.count("marginal") / len(flags),
            "out_of_domain": flags.count("out_of_domain") / len(flags),
            "note": "in-sample false-reject rate of the gate on the 82 DASD children; channels = gaze x/y + head pose x/y/z"}
    M.MODELS_DIR.mkdir(exist_ok=True)
    torch.save({"model_state_dict": model.state_dict()}, ck)
    meta = {
        "model_version": VERSION, "dataset": C.DATASET_NAME, "feature_schema_version": C.FEATURE_SCHEMA_VERSION,
        "feature_names": list(CFG.feature_names), "feature_order": {n: i for i, n in enumerate(CFG.feature_names)},
        "sequence_length": CFG.window_steps, "sampling_rate_hz": CFG.resample_hz, "preprocess_config": CFG.to_dict(),
        "normalization": norm, "openface_version": C.OPENFACE_VERSION, "openface_flags": list(C.OPENFACE_FLAGS),
        "architecture": {"type": "BiLSTM(mean+max pool)", "input_size": len(CFG.feature_names), "hidden_size": T.HIDDEN, "dropout": T.DROPOUT},
        "training_seed": T.SEED, "epochs": epochs, "lr": T.LR, "weight_decay": T.WD, "batch_size": T.BATCH,
        "decision_threshold": 0.5, "session_aggregation": "mean of window probabilities",
        "domain_reference": ref, "domain_gate": gate,
        "trained_on": {"children": len(recs), "ASD": 57, "TD": 25, "note": "all DASD children; no held-out set remains"},
        "validation_strategy": "selection: 10x repeated stratified participant-level 5-fold CV on the 55 official-train children "
                               "(model_selection/model_comparison.json); supplementary: same CV on all 82 children. "
                               "No untouched test set exists (official test split was examined during v1/v2 design).",
        "metrics": {"dev_cv_55": {k: dev_res[k] for k in ("auc", "acc", "sens", "spec", "auc_ci95_participant_bootstrap", "auc_diff_vs_v2_baseline")},
                    "supplementary_cv_82": sup,
                    "cv_summary": {"roc_auc": {"mean": dev_res["auc"]["mean"], "std": dev_res["auc"]["sd_repeats"]}}},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "limitations": ["82 children, single dataset, no external or webcam-labelled validation",
                        "AUC is statistically indistinguishable from recording-duration-only (0.89) on the dev set; context confounds cannot be excluded",
                        "signal is mostly movement amplitude (head/gaze), which is task- and context-sensitive",
                        "DASD stimulus unknown; recordings are of young children, webcam sessions so far are adults"],
    }
    mk.write_text(json.dumps(meta, indent=2, default=float))
    (Path(__file__).resolve().parents[1] / "reports" / "gaze_v3_training_history.json").write_text(json.dumps(hist, indent=1))
    print("saved", ck, mk)


if __name__ == "__main__":
    main()
