"""Toddler Q-CHAT-10 questionnaire model: candidates, protocol, evaluation, checkpoint.

    python -m backend.data.train_toddler_qchat            # full run (about 10-20 min)

TARGET: `group` (ASD vs control) from the Polish dataset - an independently recorded clinical-group label, NOT derived from any item
total.  Predictors: the ten Q-CHAT-10 items (recoded 0-4, higher = more atypical) [config A], optionally + age in months and sex
[config B, both collected by NeuroSense for toddlers], and, for information only, further demographics NeuroSense does not collect
[config C - never deployable].  `Sum_QCHAT`, ids, the recruitment-source proxy and `sibling_withASD` are never predictors.

PROTOCOL (declared before the first run)
  * Prior influence: no earlier report/artifact in this repository used this dataset (verified by grep), so a holdout is untouched.
  * Participant = row (ids unique, no duplicates).  A stratified 25% holdout (strata = class x recruitment-source group) is carved
    once with a fixed seed and NOT used for selection of model, features, hyper-parameters or threshold.
  * Development: nested cross-validation (outer 5 folds x 5 repeats, stratified; inner 5-fold grid search on ROC-AUC) for five
    candidates (L2 logistic regression, decision tree, random forest, gradient boosting, SVC) x three configs.
  * Selection (one-standard-error rule, simplest first: LR < tree < SVC < RF < GB): among CONFIG-A candidates take the best mean
    dev ROC-AUC, then the simplest model within one participant-bootstrap SE of it.  Config B replaces A only if the paired
    bootstrap 95% CI of AUC(B)-AUC(A) is > 0.
  * Decision threshold = Youden-optimal on the dev out-of-fold probabilities of the selected model (never the holdout).
  * The selected pipeline is fit on development data only, evaluated ONCE on the holdout (with participant bootstrap CIs), and saved.
    The holdout is a single 63-child sample; its results are a preliminary estimate, not an independent clinical validation.
  * Controls: label permutation, source-only model (what the recruitment source alone achieves), the official Q-CHAT-10 rule
    and the 0-4 item-sum baseline, and performance inside the source stratum where both classes exist.
"""

from __future__ import annotations

import json
import platform
import sys
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import qchat_polish as D  # noqa: E402
from backend.ml import qchat10 as Q  # noqa: E402

SEED = 2026
N_OUTER_REPEATS, N_OUTER_FOLDS, N_INNER = 5, 5, 5
HOLDOUT_FRAC = 0.25
N_BOOT = 2000
REPORTS = Path(__file__).resolve().parents[1] / "reports" / "toddler_qchat"
MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "toddler_qchat10_polish_v1"
COMPLEXITY = {"logreg": 0, "tree": 1, "svc": 2, "forest": 3, "boosting": 4}
DEMO_B = ["age_months", "female"]
DEMO_C_EXTRA = ["preterm", "birthweight", "siblings_yesno", "mothers_education"]          # info-only; not collected by NeuroSense


def frame(df: pd.DataFrame) -> pd.DataFrame:
    x = pd.DataFrame({n: df[c].to_numpy(float) for n, c in zip(Q.FEATURE_NAMES, Q.DATASET_COLUMNS)}, index=df.index)
    x["age_months"] = df.age.to_numpy(float)
    x["female"] = (df.sex == 2).astype(float).to_numpy()
    for c in DEMO_C_EXTRA:
        x[c] = df[c].to_numpy(float)
    return x


CONFIGS = {"A: items only": list(Q.FEATURE_NAMES), "B: items + age + sex": list(Q.FEATURE_NAMES) + DEMO_B,
           "C: + other demographics (info only)": list(Q.FEATURE_NAMES) + DEMO_B + DEMO_C_EXTRA}


def candidates():
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC
    from sklearn.tree import DecisionTreeClassifier
    imp = lambda: SimpleImputer(strategy="median")
    return {
        "logreg": (make_pipeline(imp(), StandardScaler(), LogisticRegression(max_iter=5000, class_weight="balanced")),
                   {"logisticregression__C": [0.01, 0.03, 0.1, 0.3, 1.0, 10.0]}),
        "tree": (make_pipeline(imp(), DecisionTreeClassifier(class_weight="balanced", random_state=SEED)),
                 {"decisiontreeclassifier__max_depth": [2, 3, 4], "decisiontreeclassifier__min_samples_leaf": [5, 10]}),
        "svc": (make_pipeline(imp(), StandardScaler(), SVC(probability=True, class_weight="balanced", random_state=SEED)),
                {"svc__C": [0.1, 1.0, 10.0], "svc__kernel": ["linear", "rbf"]}),
        "forest": (make_pipeline(imp(), RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=SEED, n_jobs=1)),
                   {"randomforestclassifier__max_depth": [2, 3, None], "randomforestclassifier__min_samples_leaf": [3, 8]}),
        "boosting": (make_pipeline(imp(), GradientBoostingClassifier(random_state=SEED)),
                     {"gradientboostingclassifier__n_estimators": [50, 100], "gradientboostingclassifier__max_depth": [1, 2],
                      "gradientboostingclassifier__learning_rate": [0.05, 0.1]}),
    }


# ── metrics ──────────────────────────────────────────────────────────────────

def ece(y, p, bins=10):
    idx = np.minimum((p * bins).astype(int), bins - 1); e = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            e += m.mean() * abs(p[m].mean() - y[m].mean())
    return float(e)


def calibration_line(y, p):
    from sklearn.linear_model import LogisticRegression
    z = np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4))).reshape(-1, 1)
    m = LogisticRegression(C=1e6, max_iter=1000).fit(z, y)
    return {"slope": float(m.coef_[0, 0]), "intercept": float(m.intercept_[0])}


def metrics(y, p, thr):
    from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss, confusion_matrix, f1_score,
                                 precision_score, recall_score, roc_auc_score)
    y = np.asarray(y); p = np.asarray(p, float); pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {"n": int(len(y)), "n_asd": int(y.sum()), "n_control": int((1 - y).sum()), "threshold": float(thr),
            "roc_auc": float(roc_auc_score(y, p)) if len(set(y)) == 2 else None,
            "pr_auc": float(average_precision_score(y, p)) if len(set(y)) == 2 else None,
            "accuracy": float(accuracy_score(y, pred)), "precision": float(precision_score(y, pred, zero_division=0)),
            "sensitivity": float(recall_score(y, pred, zero_division=0)), "specificity": float(tn / (tn + fp)) if tn + fp else None,
            "f1": float(f1_score(y, pred, zero_division=0)), "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "brier": float(brier_score_loss(y, p)), "ece_10bin": ece(y, p), "calibration": calibration_line(y, p) if len(set(y)) == 2 else None}


def boot_ci(fn, y, *arrs, n=N_BOOT, seed=0):
    rng = np.random.default_rng(seed); y = np.asarray(y); v = []
    for _ in range(n):
        i = rng.integers(0, len(y), len(y))
        if len(set(y[i])) == 2:
            v.append(fn(y[i], *[np.asarray(a)[i] for a in arrs]))
    return [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))], float(np.std(v))


def youden_threshold(y, p):
    best, thr = -1.0, 0.5
    for t in np.unique(np.r_[0.0, np.round(p, 6), 1.0]):
        pred = p >= t
        j = (pred[y == 1].mean() if (y == 1).any() else 0) + ((~pred[y == 0]).mean() if (y == 0).any() else 0) - 1
        if j > best + 1e-12:
            best, thr = j, float(t)
    return thr


# ── nested cross-validation ──────────────────────────────────────────────────

def nested_oof(model_key, cols, X, y, strata, seed):
    """One repeat: outer stratified 5-fold; inner grid search on ROC-AUC.  -> out-of-fold probability for every dev participant."""
    from sklearn.model_selection import GridSearchCV, StratifiedKFold
    est, grid = candidates()[model_key]
    oof = np.zeros(len(y)); chosen = []
    for tr, te in StratifiedKFold(N_OUTER_FOLDS, shuffle=True, random_state=seed).split(X, strata):
        gs = GridSearchCV(est, grid, scoring="roc_auc", cv=StratifiedKFold(N_INNER, shuffle=True, random_state=seed + 1), n_jobs=1)
        gs.fit(X.iloc[tr][cols], y[tr])
        oof[te] = gs.predict_proba(X.iloc[te][cols])[:, 1]; chosen.append(gs.best_params_)
    return oof, chosen


def evaluate_candidate(model_key, cols, X, y, strata):
    from joblib import Parallel, delayed
    from sklearn.metrics import roc_auc_score
    res = Parallel(n_jobs=-1)(delayed(nested_oof)(model_key, cols, X, y, strata, SEED + r) for r in range(N_OUTER_REPEATS))
    oofs = [r[0] for r in res]
    aucs = [roc_auc_score(y, o) for o in oofs]
    mean_p = np.mean(oofs, axis=0)
    return {"oof_repeats": oofs, "oof_mean": mean_p, "auc_per_repeat": [float(a) for a in aucs], "chosen_params": [c for r in res for c in r[1]]}


def main(quick: bool = False):
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import train_test_split
    t0 = time.time(); REPORTS.mkdir(parents=True, exist_ok=True)
    df = D.load_clean()
    df["strata"] = df.y.astype(str) + "_" + np.where(df.source == "bdbp#", "bdbp", "other")
    ids = df.child_id.to_numpy()
    dev_idx, hold_idx = train_test_split(np.arange(len(df)), test_size=HOLDOUT_FRAC, stratify=df.strata, random_state=SEED)
    assert not set(ids[dev_idx]) & set(ids[hold_idx])
    dev, hold = df.iloc[dev_idx].reset_index(drop=True), df.iloc[hold_idx].reset_index(drop=True)
    Xd, yd, sd = frame(dev), dev.y.to_numpy(), dev.strata.to_numpy()
    Xh, yh = frame(hold), hold.y.to_numpy()
    split_info = {"seed": SEED, "holdout_fraction": HOLDOUT_FRAC, "dev": {"n": len(dev), "asd": int(yd.sum()), "control": int((1 - yd).sum())},
                  "holdout": {"n": len(hold), "asd": int(yh.sum()), "control": int((1 - yh).sum())},
                  "strata_dev": dev.strata.value_counts().to_dict(), "strata_holdout": hold.strata.value_counts().to_dict(),
                  "participant_overlap": 0}
    print("split", json.dumps(split_info), flush=True)
    pd.DataFrame({"child_id": dev.child_id, "set": "dev"}).pipe(lambda a: pd.concat([a, pd.DataFrame({"child_id": hold.child_id, "set": "holdout"})])).to_csv(REPORTS / "participant_split.csv", index=False)

    results = {}
    keys = ["logreg", "tree", "svc", "forest", "boosting"] if not quick else ["logreg", "tree"]
    for cfg, cols in CONFIGS.items():
        for k in keys:
            tt = time.time(); r = evaluate_candidate(k, cols, Xd, yd, sd)
            results[(cfg, k)] = r
            print(f"[dev nested CV] {cfg:36s} {k:9s} AUC {np.mean(r['auc_per_repeat']):.3f} ±{np.std(r['auc_per_repeat']):.3f} ({time.time() - tt:.0f}s)", flush=True)

    # baselines on dev (no fitting involved)
    ten = Xd[list(Q.FEATURE_NAMES)]
    base = {"official Q-CHAT-10 points (0-10)": (ten >= 2).sum(axis=1).to_numpy(float) / 10.0, "item sum (0-40)": ten.sum(axis=1).to_numpy() / 40.0}
    # controls
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import StratifiedKFold
    rng = np.random.default_rng(SEED)
    perm_aucs = []
    for r_ in range(N_OUTER_REPEATS):
        yp = rng.permutation(yd); o = np.zeros(len(yd))
        for tr, te in StratifiedKFold(5, shuffle=True, random_state=SEED + r_).split(Xd, sd):
            from sklearn.pipeline import make_pipeline
            from sklearn.preprocessing import StandardScaler
            m = make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=2000)).fit(Xd.iloc[tr][list(Q.FEATURE_NAMES)], yp[tr]); o[te] = m.predict_proba(Xd.iloc[te][list(Q.FEATURE_NAMES)])[:, 1]
        perm_aucs.append(float(roc_auc_score(yp, o)))
    srcX = pd.get_dummies(dev.source).astype(float)
    src_oof = np.zeros(len(yd))
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=SEED).split(srcX, sd):
        src_oof[te] = LogisticRegression(max_iter=1000).fit(srcX.iloc[tr], yd[tr]).predict_proba(srcX.iloc[te])[:, 1]
    controls = {"label_permutation_auc_per_repeat": perm_aucs, "source_only_auc": float(roc_auc_score(yd, src_oof)),
                "age_sex_only_auc_note": "see single-variable AUCs in dataset_audit.json"}

    # summary table + bootstrap SEs
    table = []
    for (cfg, k), r in results.items():
        ci, se = boot_ci(roc_auc_score, yd, r["oof_mean"], seed=1)
        table.append({"config": cfg, "model": k, "auc_mean": float(np.mean(r["auc_per_repeat"])), "auc_sd_repeats": float(np.std(r["auc_per_repeat"])),
                      "auc_of_mean_oof": float(roc_auc_score(yd, r["oof_mean"])), "auc_ci95": ci, "auc_boot_se": se})
    # selection
    A = [t for t in table if t["config"].startswith("A")]
    best = max(A, key=lambda t: t["auc_mean"])
    within = [t for t in A if t["auc_mean"] >= best["auc_mean"] - best["auc_boot_se"]]
    sel = sorted(within, key=lambda t: (COMPLEXITY[t["model"]], -t["auc_mean"]))[0]
    cfg_choice = sel["config"]; reason = "config A (items only) is the deployed questionnaire schema"
    selB = next((t for t in table if t["config"].startswith("B") and t["model"] == sel["model"]), None)
    if selB:
        d_ci, _ = boot_ci(lambda y_, a, b: roc_auc_score(y_, a) - roc_auc_score(y_, b), yd, results[(selB["config"], sel["model"])]["oof_mean"], results[(sel["config"], sel["model"])]["oof_mean"], seed=2)
        sel_vs_B = {"auc_B_minus_A_ci95": d_ci, "adopted_B": bool(d_ci[0] > 0)}
        if d_ci[0] > 0:
            cfg_choice = selB["config"]; reason = "config B improved AUC with CI > 0 (age in months and sex are collected)"
    else:
        sel_vs_B = None
    print("SELECTED", sel["model"], cfg_choice, "| best A:", best["model"], round(best["auc_mean"], 3), "| 1SE set:", [t["model"] for t in within], flush=True)

    # recalibration (linear model only), derived from DEVELOPMENT out-of-fold predictions: dev calibration of the regularised model was
    # poor (slope ~3, i.e. under-confident); p' = sigmoid(slope * logit(p) + intercept) is folded into the coefficients exactly.
    oof_raw = results[(cfg_choice, sel["model"])]["oof_mean"]
    recal = None
    if sel["model"] == "logreg":
        recal = calibration_line(yd, oof_raw)
        z = np.log(np.clip(oof_raw, 1e-4, 1 - 1e-4) / (1 - np.clip(oof_raw, 1e-4, 1 - 1e-4)))
        oof = 1 / (1 + np.exp(-(recal["slope"] * z + recal["intercept"])))
    else:
        oof = oof_raw
    dev_metrics_uncalibrated = metrics(yd, oof_raw, youden_threshold(yd, oof_raw))
    # threshold on dev OOF of the selected model (never the holdout)
    thr = youden_threshold(yd, oof)
    dev_metrics = metrics(yd, oof, thr)
    dev_ci = {m_: boot_ci(lambda y_, p_, m_=m_: metrics(y_, p_, thr)[m_], yd, oof, n=500, seed=3)[0] for m_ in ("roc_auc", "pr_auc", "sensitivity", "specificity", "accuracy", "f1", "brier")}
    fold_level = {"auc_per_repeat": results[(cfg_choice, sel["model"])]["auc_per_repeat"]}
    base_dev = {n: {"roc_auc": float(roc_auc_score(yd, s)), "at_official_cutoff_3": metrics(yd, (np.round(s * 10) >= 3).astype(float), 0.5) if n.startswith("official") else None} for n, s in base.items()}
    mask = (dev.source != "bdbp#").to_numpy()
    strat_dev = {"non-bdbp stratum (both classes present)": metrics(yd[mask], oof[mask], thr), "bdbp stratum": {"note": f"only {int(yd[~mask].sum())} ASD children: not evaluable", "n": int((~mask).sum())}}

    # final fit on DEV only; holdout evaluated once
    from sklearn.model_selection import GridSearchCV
    est, grid = candidates()[sel["model"]]; cols = CONFIGS[cfg_choice]
    gs = GridSearchCV(est, grid, scoring="roc_auc", cv=StratifiedKFold(N_INNER, shuffle=True, random_state=SEED + 1)).fit(Xd[cols], yd)
    final = gs.best_estimator_
    if recal is not None:
        lr = final.named_steps["logisticregression"]
        lr.coef_ = lr.coef_ * recal["slope"]; lr.intercept_ = lr.intercept_ * recal["slope"] + recal["intercept"]
    ph = final.predict_proba(Xh[cols])[:, 1]
    hold_metrics = metrics(yh, ph, thr)
    hold_ci = {m_: boot_ci(lambda y_, p_, m_=m_: metrics(y_, p_, thr)[m_], yh, ph, n=1000, seed=4)[0] for m_ in ("roc_auc", "pr_auc", "sensitivity", "specificity", "accuracy", "f1", "brier")}
    off_h = (Xh[list(Q.FEATURE_NAMES)] >= 2).sum(axis=1).to_numpy()
    hold_base = {"official_qchat10_rule_cutoff_3": metrics(yh, (off_h >= 3).astype(float), 0.5), "official_points_auc": float(roc_auc_score(yh, off_h)),
                 "auc_model_minus_official_points_ci95": boot_ci(lambda y_, a, b: roc_auc_score(y_, a) - roc_auc_score(y_, b), yh, ph, off_h, seed=5)[0]}
    mh = (hold.source != "bdbp#").to_numpy()
    strat_hold = {"non-bdbp stratum": metrics(yh[mh], ph[mh], thr) if len(set(yh[mh])) == 2 else None, "bdbp stratum": {"n": int((~mh).sum()), "asd": int(yh[~mh].sum()), "note": "ASD too rare to evaluate"}}
    print("HOLDOUT (evaluated once):", json.dumps({k: hold_metrics[k] for k in ("roc_auc", "pr_auc", "sensitivity", "specificity", "accuracy")}), flush=True)

    # save predictions + tables
    pd.DataFrame({"child_id": dev.child_id, "y": yd, "oof_probability": oof, "source": dev.source}).to_csv(REPORTS / "dev_oof_predictions.csv", index=False)
    pd.DataFrame({"child_id": hold.child_id, "y": yh, "probability": ph, "official_points": off_h, "source": hold.source}).to_csv(REPORTS / "holdout_predictions.csv", index=False)
    pd.DataFrame(table).to_csv(REPORTS / "model_comparison.csv", index=False)

    # checkpoint
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    from backend.ml import toddler_model as TM
    meta = {
        "model_version": "toddler-qchat10-polish-v1", "task": "ASD-group vs control from Q-CHAT-10 item responses (Polish cohort)",
        "dataset": {"citation": D.CITATION, "file": D.SAV.name, "sha256": D.SHA256, "licence": "CC BY 4.0", "rows": int(len(df))},
        "label": {"field": "group", "positive": "ASD", "provenance": "community-based diagnosis per dataset page; ADOS-2/ADI-R/DSM-5 use NOT verified"},
        "feature_names": cols, "feature_order": {n: i for i, n in enumerate(cols)},
        "response_encoding": {"client_input": "option letter A-E per item Q1..Q10", "model_input": "recode 0-4, higher = more atypical",
                              "qchat25_items": list(Q.QCHAT25_ITEM_NUMBERS), "dataset_columns": list(Q.DATASET_COLUMNS), "q10_reversed_scale": True},
        "config": cfg_choice, "algorithm": sel["model"], "hyperparameters": gs.best_params_, "selection": {"criterion": "one-SE rule on dev nested-CV ROC-AUC, simplest first; " + reason,
            "best_config_A": best, "within_one_se": [t["model"] for t in within], "config_B_vs_A": sel_vs_B},
        "seed": SEED, "split": split_info, "cross_validation": f"nested: outer {N_OUTER_REPEATS}x{N_OUTER_FOLDS}-fold stratified, inner {N_INNER}-fold grid search (ROC-AUC)",
        "decision_threshold": thr, "threshold_rule": "Youden J on (recalibrated) dev out-of-fold probabilities",
        "recalibration": None if recal is None else {**recal, "fit_on": "dev out-of-fold predictions only", "form": "folded into model.json coefficients",
            "dev_metrics_before_recalibration": {k: dev_metrics_uncalibrated[k] for k in ("brier", "ece_10bin", "calibration")}},
        "metrics": {"dev_oof": dev_metrics, "dev_oof_ci95": dev_ci, "dev_fold_level": fold_level, "holdout_once": hold_metrics, "holdout_ci95": hold_ci,
                    "baselines_dev": base_dev, "baselines_holdout": hold_base, "stratified_dev": strat_dev, "stratified_holdout": strat_hold, "controls": controls},
        "validated_for_deployment": False,
        "trained_at": datetime.now(timezone.utc).isoformat(), "environment": {"python": platform.python_version(), "platform": platform.platform(),
            "numpy": np.__version__, "pandas": pd.__version__, "sklearn": __import__("sklearn").__version__},
        "population_note": "case-control sample (53.6% ASD); outputs are NOT population risk probabilities",
        "limitations": json.loads((REPORTS / "dataset_audit.json").read_text())["sampling_limitations"] if (REPORTS / "dataset_audit.json").exists() else []}
    TM.save_checkpoint(MODEL_DIR, final, cols, meta, background=Xd[cols].sample(min(100, len(Xd)), random_state=SEED))
    (REPORTS / "evaluation.json").write_text(json.dumps({"table": table, "selected": {"model": sel["model"], "config": cfg_choice}, "metadata": meta}, indent=1, default=float))
    print(f"saved {MODEL_DIR}  ({time.time() - t0:.0f}s)")
    return meta


if __name__ == "__main__":
    main(quick="--quick" in sys.argv)
