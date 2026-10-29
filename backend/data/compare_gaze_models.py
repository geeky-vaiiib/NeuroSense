"""Participant-level comparison of the BiLSTM against LR / gradient boosting on session summaries.

    python -m backend.data.compare_gaze_models

PRE-DECLARED PROTOCOL (fixed before the first run)
  * Development set = the 55 official-train children ONLY.  The official test split was examined
    when v1 and v2 were designed, so it is NOT loaded here and is not treated as untouched.
  * Identical folds for every model: stratified participant-level 5-fold, 10 repeats (seeds 101..110);
    BiLSTM inner early-stopping holdout is also seeded identically (seed + fold).
  * Hyper-parameters are fixed in advance (no tuning): LR C=0.3 balanced; GB 100 trees, depth 2,
    lr 0.05, subsample 0.8; BiLSTM = deployed v2 architecture/recipe.
  * Metric: participant-level pooled out-of-fold ROC-AUC per repeat (+ accuracy / sensitivity /
    specificity at 0.5).  Uncertainty: sd over repeats, and a 2000x participant bootstrap of the
    repeat-averaged out-of-fold probabilities (95% CI; paired for differences).
  * Selection rule (one-standard-error, favours simpler/faster/explainable): among models whose mean AUC
    is >= (best mean AUC - bootstrap SE of the best), pick the simplest (LR < GB < BiLSTM; within a
    family fewer channels, then higher AUC).
"""

from __future__ import annotations

import dataclasses
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.data import train_gaze_openface_dasd as T  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import inference as I  # noqa: E402
from backend.ml.gaze import summary as S  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports" / "model_selection"
SEEDS = tuple(range(101, 111))
G2 = ("gaze_angle_x", "gaze_angle_y"); H3 = ("head_pose_x", "head_pose_y", "head_pose_z")
FEATURE_SETS = {"gaze-only": G2, "head-only": H3, "gaze+head": G2 + H3}
COMPLEXITY = {"LR": 0, "GB": 1, "BiLSTM": 2}
N_BOOT = 2000


def sk_model(kind, seed):
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    if kind == "LR":
        return LogisticRegression(C=0.3, class_weight="balanced", max_iter=5000)
    return GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05, subsample=0.8, random_state=seed)


def oof_sklearn(kind, data, dev, cfg, seed):
    from sklearn.preprocessing import StandardScaler
    from sklearn.utils.class_weight import compute_sample_weight
    feats = {r.participant_id: S.session_summary(data[r.participant_id][1], cfg.resample_hz)
             for r in dev if len(data[r.participant_id][1])}
    out = {}
    for tr, te in dasd.stratified_participant_folds(dev, T.N_FOLDS, seed):
        tr = [r for r in tr if r.participant_id in feats]; te = [r for r in te if r.participant_id in feats]
        X = np.array([feats[r.participant_id] for r in tr]); y = np.array([r.label for r in tr])
        sc = StandardScaler().fit(X); m = sk_model(kind, seed)
        if kind == "GB":
            m.fit(sc.transform(X), y, sample_weight=compute_sample_weight("balanced", y))
        else:
            m.fit(sc.transform(X), y)
        p = m.predict_proba(sc.transform(np.array([feats[r.participant_id] for r in te])))[:, 1]
        out.update({r.participant_id: float(q) for r, q in zip(te, p)})
    return out


def oof_bilstm(data, dev, cfg, seed):
    out = {}
    for k, (tr, te) in enumerate(dasd.stratified_participant_folds(dev, T.N_FOLDS, seed)):
        tr2, va = dasd.holdout_split(tr, 0.15, seed + k)
        model, norm, _h, _e = T.fit(data, tr2, cfg, seed + k, val_recs=va)
        ids, _y, p = T.participant_probs(model, norm, data, te)
        out.update(dict(zip(ids, p)))
    return out


def metrics_from(oof, labels):
    from sklearn.metrics import roc_auc_score
    ids = sorted(oof); y = np.array([labels[i] for i in ids]); p = np.array([oof[i] for i in ids])
    pred = p >= 0.5
    return {"auc": float(roc_auc_score(y, p)), "acc": float((pred == y).mean()),
            "sens": float(pred[y == 1].mean()), "spec": float((~pred[y == 0]).mean())}


def main():
    t0 = time.time(); OUT.mkdir(parents=True, exist_ok=True)
    recs = dasd.discover(); dev, _unused_test = dasd.official_split(recs)       # test split never read below
    labels = {r.participant_id: r.label for r in dev}
    rng = np.random.default_rng(0)
    results, oof_mean = {}, {}
    base_cfg = C.DEPLOYED
    for fs_name, names in FEATURE_SETS.items():
        cfg = dataclasses.replace(base_cfg, feature_names=names)
        data = T.load_windows(dev, cfg)
        for kind in ("LR", "GB", "BiLSTM"):
            key = f"{kind} / {fs_name}"; reps = []; probs = []; tt = time.time()
            for sd in SEEDS:
                o = oof_bilstm(data, dev, cfg, sd) if kind == "BiLSTM" else oof_sklearn(kind, data, dev, cfg, sd)
                reps.append(metrics_from(o, labels)); probs.append(o)
            ids = sorted(probs[0]); mean_p = {i: float(np.mean([p[i] for p in probs])) for i in ids}
            oof_mean[key] = mean_p
            results[key] = {"kind": kind, "features": fs_name, "channels": list(names), "repeats": reps,
                            **{m: {"mean": float(np.mean([r[m] for r in reps])), "sd_repeats": float(np.std([r[m] for r in reps]))}
                               for m in ("auc", "acc", "sens", "spec")}, "seconds": round(time.time() - tt, 1)}
            print(f"{key:24s} AUC {results[key]['auc']['mean']:.3f}±{results[key]['auc']['sd_repeats']:.3f}  "
                  f"acc {results[key]['acc']['mean']:.3f} sens {results[key]['sens']['mean']:.3f} spec {results[key]['spec']['mean']:.3f}  ({results[key]['seconds']}s)", flush=True)
    # reference points: duration alone (a leak, shown for scale) and one motion statistic (head-yaw std) with LR
    from sklearn.metrics import roc_auc_score
    ids = sorted(labels); y = np.array([labels[i] for i in ids])
    dur = {r.participant_id: float(np.ptp(dasd.read_csv(r)[" timestamp"].to_numpy(float))) for r in dev}
    results["reference: recording duration only (leaky)"] = {"auc": {"mean": float(roc_auc_score(y, [dur[i] for i in ids]))}}
    cfgH = dataclasses.replace(base_cfg, feature_names=H3); dH = T.load_windows(dev, cfgH)
    hy = {i: S.session_summary(dH[i][1], 10)[S.feature_names(H3).index("head_pose_y:std")] for i in ids if len(dH[i][1])}
    ids2 = [i for i in ids if i in hy]
    results["reference: single statistic head-yaw std (no model)"] = {"auc": {"mean": float(roc_auc_score([labels[i] for i in ids2], [hy[i] for i in ids2]))}}
    # bootstrap over participants
    keys = list(oof_mean); ids = sorted(labels); yv = np.array([labels[i] for i in ids])
    P = {k: np.array([oof_mean[k].get(i, np.nan) for i in ids]) for k in keys}
    ok = np.all([np.isfinite(P[k]) for k in keys], axis=0); ids_ok = [i for i, o in zip(ids, ok) if o]; yv = yv[ok]
    P = {k: v[ok] for k, v in P.items()}
    B = {k: [] for k in keys}; draws = []
    for _ in range(N_BOOT):
        idx = rng.integers(0, len(yv), len(yv))
        if len(set(yv[idx])) < 2: continue
        draws.append(idx)
        for k in keys: B[k].append(roc_auc_score(yv[idx], P[k][idx]))
    for k in keys:
        a = np.array(B[k]); results[k]["auc_ci95_participant_bootstrap"] = [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))]
        results[k]["auc_bootstrap_se"] = float(a.std()); results[k]["auc_of_repeat_averaged_oof"] = float(roc_auc_score(yv, P[k]))
    base = "BiLSTM / gaze+head"
    for k in keys:
        diff = np.array(B[k]) - np.array(B[base]); results[k]["auc_diff_vs_v2_baseline"] = {
            "mean": float(diff.mean()), "ci95": [float(np.percentile(diff, 2.5)), float(np.percentile(diff, 97.5))]}
    best = max(keys, key=lambda k: results[k]["auc"]["mean"])
    thr = results[best]["auc"]["mean"] - results[best]["auc_bootstrap_se"]
    eligible = [k for k in keys if results[k]["auc"]["mean"] >= thr]
    chosen = sorted(eligible, key=lambda k: (COMPLEXITY[results[k]["kind"]], len(results[k]["channels"]), -results[k]["auc"]["mean"]))[0]
    sel = {"best_by_mean_auc": best, "threshold_auc": thr, "within_one_se": eligible, "chosen": chosen, "rule": __doc__.split("Selection rule")[1].strip()}
    (OUT / "model_comparison.json").write_text(json.dumps({"selection": sel, "results": results, "n_dev": len(ids_ok), "seeds": SEEDS}, indent=1, default=float))
    print("\nBEST", best, f"{results[best]['auc']['mean']:.3f}", "| within 1 SE:", eligible, "\nCHOSEN by rule:", chosen, f"| {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
