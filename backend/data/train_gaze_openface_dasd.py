"""Train + evaluate the NeuroSense gaze classifier on DASD OpenFace features.

    python -m backend.data.train_gaze_openface_dasd

Protocol (decided before looking at the test set):
  1. discover DASD, validate labels, assert participant-disjoint splits
  2. DEV  = official train split (55 participants).  Stratified participant 5-fold CV selects the
     feature variant and the epoch budget.  Test participants are never touched here.
  3. FINAL = train on all DEV participants with the selected config/epochs; evaluate ONCE on the
     official test split (27 participants); threshold fixed at 0.5 (balanced-weight loss).
  4. save checkpoint, metadata, history, confusion matrices, report.
Participant is the unit of independence; reported metrics are participant-level.
"""

from __future__ import annotations

import dataclasses
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import inference as I  # noqa: E402
from backend.ml.gaze import model as M  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402

SEED = 42
N_FOLDS = 5
MAX_EPOCHS = 40
PATIENCE = 8
LR, WD, BATCH = 2e-3, 1e-2, 64
HIDDEN, DROPOUT = 32, 0.4
REPORTS = Path(__file__).resolve().parents[1] / "reports"

GAZE4 = ("gaze_angle_x", "gaze_angle_y", "gaze_vel_x", "gaze_vel_y")
VARIANTS = {   # candidate input representations, compared on DEV CV only
    "gaze+vel": dataclasses.replace(C.PreprocessConfig(), feature_names=GAZE4),
    "gaze+vel, window-centred": dataclasses.replace(C.PreprocessConfig(), feature_names=GAZE4, center_window=True),
    "gaze+vel+head-pose": C.PreprocessConfig(),
}


def seed_all(s: int):
    np.random.seed(s); torch.manual_seed(s)
    torch.use_deterministic_algorithms(False)


# ── data ─────────────────────────────────────────────────────────────────────

def load_windows(recs, cfg):
    """pid -> (label, raw windows).  Uses the shared preprocess.prepare_session."""
    out = {}
    for r in recs:
        prep = P.prepare_session(dasd.read_csv(r), cfg)
        out[r.participant_id] = (r.label, prep.windows)
    return out


def stack(data, recs):
    X, y, pid, w = [], [], [], []
    n_pos = sum(r.label == 1 for r in recs); n_neg = len(recs) - n_pos
    cw = {1: len(recs) / (2 * n_pos), 0: len(recs) / (2 * n_neg)}   # participant-level class weights
    for r in recs:
        lab, wins = data[r.participant_id]
        if len(wins) == 0:
            continue
        X.append(wins); y += [lab] * len(wins); pid += [r.participant_id] * len(wins)
        w += [cw[lab] / len(wins)] * len(wins)      # each participant counts equally within its class
    w = np.asarray(w); w = w / w.mean()
    return np.concatenate(X), np.asarray(y, np.float32), np.asarray(pid), w.astype(np.float32)


# ── metrics ──────────────────────────────────────────────────────────────────

def participant_metrics(pids, labels, probs):
    from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                                 recall_score, roc_auc_score)
    y = np.asarray(labels); p = np.asarray(probs); pred = (p >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    auc = float(roc_auc_score(y, p)) if len(set(y)) == 2 else None
    return {"n": int(len(y)), "accuracy": float(accuracy_score(y, pred)),
            "precision": float(precision_score(y, pred, zero_division=0)),
            "recall_sensitivity": float(recall_score(y, pred, zero_division=0)),
            "specificity": float(tn / (tn + fp)) if tn + fp else None,
            "f1": float(f1_score(y, pred, zero_division=0)), "roc_auc": auc,
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}}


def participant_probs(model, norm, data, recs):
    labels, probs, ids = [], [], []
    for r in recs:
        lab, wins = data[r.participant_id]
        if len(wins) == 0:
            continue
        ids.append(r.participant_id); labels.append(lab)
        probs.append(I.aggregate(I.predict_windows(model, wins, norm)))
    return ids, labels, probs


# ── training ─────────────────────────────────────────────────────────────────

def fit(data, train_recs, cfg, seed, val_recs=None, epochs=None):
    """Train one model.  If val_recs is given, early-stop on weighted val loss; else run `epochs`."""
    seed_all(seed)
    Xtr, ytr, _, wtr = stack(data, train_recs)
    norm = P.fit_normalizer(Xtr)
    xt = torch.from_numpy(P.normalize(Xtr, norm)); yt = torch.from_numpy(ytr); wt = torch.from_numpy(wtr)
    if val_recs:
        Xv, yv, _, wv = stack(data, val_recs)
        xv = torch.from_numpy(P.normalize(Xv, norm)); yv = torch.from_numpy(yv); wv = torch.from_numpy(wv)
    model = M.GazeBiLSTM(len(cfg.feature_names), HIDDEN, DROPOUT)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WD)
    lossf = nn.BCEWithLogitsLoss(reduction="none")
    g = torch.Generator().manual_seed(seed)
    hist, best, best_state, best_ep, bad = [], 1e9, None, 0, 0
    for ep in range(1, (epochs or MAX_EPOCHS) + 1):
        model.train(); perm = torch.randperm(len(xt), generator=g); tl = 0.0
        for i in range(0, len(perm), BATCH):
            b = perm[i:i + BATCH]
            xb = xt[b] + 0.02 * torch.randn_like(xt[b])      # light noise augmentation
            loss = (lossf(model(xb), yt[b]) * wt[b]).sum() / wt[b].sum()
            opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
            tl += float(loss.detach()) * len(b)
        rec = {"epoch": ep, "train_loss": tl / len(xt)}
        if val_recs:
            model.eval()
            with torch.no_grad():
                vl = float((lossf(model(xv), yv) * wv).sum() / wv.sum())
            rec["val_loss"] = vl
            if vl < best - 1e-4:
                best, best_ep, bad = vl, ep, 0
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
            else:
                bad += 1
            if bad >= PATIENCE:
                hist.append(rec); break
        hist.append(rec)
    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model, norm, hist, (best_ep or len(hist))


def cross_validate(data, dev, cfg, seed):
    folds = []
    for k, (tr, te) in enumerate(dasd.stratified_participant_folds(dev, N_FOLDS, seed)):
        tr2, va = dasd.holdout_split(tr, 0.15, seed + k)
        model, norm, hist, ep = fit(data, tr2, cfg, seed + k, val_recs=va)
        ids, y, p = participant_probs(model, norm, data, te)
        m = participant_metrics(ids, y, p); m.update(fold=k, best_epoch=ep)
        folds.append(m)
    return folds


def summarize(folds):
    keys = ("accuracy", "precision", "recall_sensitivity", "specificity", "f1", "roc_auc")
    return {k: {"mean": float(np.mean([f[k] for f in folds if f[k] is not None])),
                "std": float(np.std([f[k] for f in folds if f[k] is not None]))} for k in keys}


def baselines(dev_recs, cfg, seed):
    """Context only: duration-only AUC and a logistic regression on window-summary stats (dev CV)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    dur = {r.participant_id: float(np.ptp(dasd.read_csv(r)[" timestamp"].to_numpy(float))) for r in dev_recs}
    y = np.array([r.label for r in dev_recs])
    out = {"duration_only_auc_dev": float(roc_auc_score(y, [dur[r.participant_id] for r in dev_recs]))}
    data = load_windows(dev_recs, cfg)
    def feat(r):
        w = data[r.participant_id][1]
        return np.concatenate([w.std(1).mean(0), np.abs(w).mean((0, 1))]) if len(w) else np.zeros(2 * w.shape[-1])
    aucs = []
    for tr, te in dasd.stratified_participant_folds(dev_recs, N_FOLDS, seed):
        Xa = np.array([feat(r) for r in tr]); Xb = np.array([feat(r) for r in te])
        mu, sd = Xa.mean(0), Xa.std(0) + 1e-9
        lr = LogisticRegression(class_weight="balanced", max_iter=1000).fit((Xa - mu) / sd, [r.label for r in tr])
        aucs.append(roc_auc_score([r.label for r in te], lr.predict_proba((Xb - mu) / sd)[:, 1]))
    out["logreg_window_summary_cv_auc"] = {"mean": float(np.mean(aucs)), "std": float(np.std(aucs))}
    return out


def plot_cm(cm, title, path):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    a = np.array([[cm["tn"], cm["fp"]], [cm["fn"], cm["tp"]]])
    fig, ax = plt.subplots(figsize=(3.4, 3.2)); ax.imshow(a, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, a[i, j], ha="center", va="center", fontsize=14)
    ax.set_xticks([0, 1], ["TD", "ASD"]); ax.set_yticks([0, 1], ["TD", "ASD"])
    ax.set_xlabel("predicted"); ax.set_ylabel("actual"); ax.set_title(title, fontsize=9)
    fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)


def main():
    t0 = time.time(); REPORTS.mkdir(exist_ok=True); seed_all(SEED)
    recs = dasd.discover(); counts = dasd.validate_labels(recs)
    train_recs, test_recs = dasd.official_split(recs); dasd.assert_disjoint(train_recs, test_recs)
    print(f"DASD {counts}; dev(train)={len(train_recs)} test={len(test_recs)} (test untouched until step 3)")

    # ── 2. DEV: variant selection by participant-level CV ──
    cv = {}
    for name, cfg in VARIANTS.items():
        data = load_windows(train_recs, cfg)
        folds = cross_validate(data, train_recs, cfg, SEED)
        cv[name] = {"folds": folds, "summary": summarize(folds)}
        s = cv[name]["summary"]
        print(f"[CV] {name:30s} AUC {s['roc_auc']['mean']:.3f}±{s['roc_auc']['std']:.3f}  "
              f"acc {s['accuracy']['mean']:.3f}  sens {s['recall_sensitivity']['mean']:.3f}  spec {s['specificity']['mean']:.3f}")
    best_name = max(cv, key=lambda n: cv[n]["summary"]["roc_auc"]["mean"])
    cfg = VARIANTS[best_name]
    epochs = int(np.median([f["best_epoch"] for f in cv[best_name]["folds"]]))
    base = baselines(train_recs, cfg, SEED)
    print(f"selected: {best_name}; epochs={epochs}; baselines={base}")

    # ── 3. FINAL: train on all dev participants, test once ──
    if cfg != C.DEPLOYED:
        print("NOTE: selected config differs from config.DEPLOYED -> update config.DEPLOYED to the config below")
        print(json.dumps(cfg.to_dict()))
    data_tr = load_windows(train_recs, cfg)
    model, norm, hist, _ = fit(data_tr, train_recs, cfg, SEED, val_recs=None, epochs=epochs)
    ids_tr, y_tr, p_tr = participant_probs(model, norm, data_tr, train_recs)
    train_m = participant_metrics(ids_tr, y_tr, p_tr)
    data_te = load_windows(test_recs, cfg)
    ids_te, y_te, p_te = participant_probs(model, norm, data_te, test_recs)
    test_m = participant_metrics(ids_te, y_te, p_te)
    wins_te = [(data_te[i][0], I.predict_windows(model, data_te[i][1], norm)) for i in ids_te]
    test_m["window_level_accuracy"] = float(np.mean([((p >= 0.5) == bool(l)).mean() for l, p in wins_te]))
    print("TEST (participant level):", json.dumps(test_m, indent=1))

    # ── 4. persist ──
    plot_cm(test_m["confusion_matrix"], "Test (participant level)", REPORTS / "gaze_confusion_test.png")
    cvcm = {k: sum(f["confusion_matrix"][k] for f in cv[best_name]["folds"]) for k in ("tn", "fp", "fn", "tp")}
    plot_cm(cvcm, "Dev CV, pooled folds", REPORTS / "gaze_confusion_cv.png")
    (REPORTS / "gaze_training_history.json").write_text(json.dumps(hist, indent=1))
    M.MODELS_DIR.mkdir(exist_ok=True)
    torch.save({"model_state_dict": model.state_dict()}, M.CHECKPOINT_PATH)
    meta = {
        "model_version": C.MODEL_VERSION, "dataset": C.DATASET_NAME,
        "feature_schema_version": C.FEATURE_SCHEMA_VERSION,
        "feature_names": list(cfg.feature_names), "feature_order": {n: i for i, n in enumerate(cfg.feature_names)},
        "sequence_length": cfg.window_steps, "sampling_rate_hz": cfg.resample_hz,
        "preprocess_config": cfg.to_dict(), "normalization": norm,
        "openface_version": C.OPENFACE_VERSION, "openface_flags": list(C.OPENFACE_FLAGS),
        "architecture": {"type": "BiLSTM(mean+max pool)", "input_size": len(cfg.feature_names),
                         "hidden_size": HIDDEN, "dropout": DROPOUT},
        "training_seed": SEED, "epochs": epochs, "lr": LR, "weight_decay": WD, "batch_size": BATCH,
        "decision_threshold": 0.5, "session_aggregation": "mean of window probabilities",
        "validation_strategy": f"{N_FOLDS}-fold stratified participant-level CV on the official train split "
                               "(55 participants); official test split (27) used once",
        "participants": {"train": len(train_recs), "test": len(test_recs), **counts},
        "metrics": {"cv_selected_variant": best_name, "cv_summary": cv[best_name]["summary"],
                    "cv_all_variants": {k: v["summary"] for k, v in cv.items()},
                    "train_resubstitution": train_m, "test": test_m, "baselines_dev": base},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "limitations": ["82 children; official test set has 8 TD participants (very wide CIs)",
                        "DASD stimulus/task and recording setup unknown; differs from NeuroSense 30 s task",
                        "ASD/TD recording duration and frame rate differ in DASD (controlled by fixed windows)",
                        "not validated on webcam data with ground-truth labels"],
    }
    M.METADATA_PATH.write_text(json.dumps(meta, indent=2, default=float))
    (REPORTS / "gaze_cv_results.json").write_text(json.dumps(cv, indent=1, default=float))
    print(f"saved {M.CHECKPOINT_PATH} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
