"""Dev-CV experiments on the gaze representation (test split is never loaded).

    python -m backend.data.experiment_gaze_representation

A. feature ablation   B. normalization / head-relative gaze   C. summary-statistic models
Every transformation is part of PreprocessConfig, so training and inference use the same code.
Webcam sessions are used ONLY to measure distribution coverage and model behaviour, never as labelled data.
"""

from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.data import train_gaze_openface_dasd as T  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import inference as I  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports" / "domain_diagnosis"
REPEATS, SEEDS = 3, (11, 22, 33)
WEB_DIR = Path(__file__).parent / "webcam_validation"
G2 = ("gaze_angle_x", "gaze_angle_y")
V2 = ("gaze_vel_x", "gaze_vel_y")
H3 = ("head_pose_x", "head_pose_y", "head_pose_z")
R2 = ("gaze_rel_x", "gaze_rel_y")
RV2 = ("gaze_rel_vel_x", "gaze_rel_vel_y")


def fit_slopes(recs) -> tuple[float, float]:
    cat = pd.concat([P.standardize_frame(dasd.read_csv(r)) for r in recs])
    return (float(np.polyfit(cat.pose_Ry, cat.gaze_angle_x, 1)[0]), float(np.polyfit(cat.pose_Rx, cat.gaze_angle_y, 1)[0]))


def agg(folds_list):
    keys = ("roc_auc", "accuracy", "recall_sensitivity", "specificity", "f1")
    out = {}
    for k in keys:
        per = [np.mean([f[k] for f in folds]) for folds in folds_list]   # mean per repeat
        out[k] = {"mean": float(np.mean(per)), "sd_over_repeats": float(np.std(per)),
                  "sd_over_folds": float(np.std([f[k] for folds in folds_list for f in folds]))}
    return out


# ── coverage of webcam sessions inside the DASD per-child distribution ──────
def coverage(cfg, dev_recs, web_raw):
    def sess(df):
        prep = P.prepare_session(df, dataclasses.replace(cfg))
        f = P.build_features(prep.resampled, cfg); f = f[np.isfinite(f).all(1)]
        return f.mean(0), f.std(0)
    d = [sess(dasd.read_csv(r)) for r in dev_recs]; w = [sess(x) for x in web_raw]
    dm, ds = np.array([a for a, _ in d]), np.array([b for _, b in d]); wm, ws = np.array([a for a, _ in w]), np.array([b for _, b in w])
    inside_std = ((ws >= ds.min(0)) & (ws <= ds.max(0)))
    inside_mean = ((wm >= dm.min(0)) & (wm <= dm.max(0)))
    # median ratio of webcam std to DASD median std per feature
    ratio = np.median(ws, 0) / np.median(ds, 0)
    return {"mean_inside_range": float(inside_mean.mean()), "std_inside_range": float(inside_std.mean()),
            "std_ratio_webcam_over_dasd_median": dict(zip(cfg.feature_names, ratio.round(3).tolist()))}


def webcam_probs(model, norm, cfg, web_raw):
    return [round(I.aggregate(I.predict_windows(model, P.prepare_session(x, cfg).windows, norm)), 3) for x in web_raw]


# ── summary-statistic model ─────────────────────────────────────────────────
def summarize(w: np.ndarray, names, hz, with_abs: bool) -> np.ndarray:
    """(W, L, F) position channels -> (W, k) robust per-window statistics (deployable, same windows)."""
    feats = []
    for j in range(w.shape[2]):
        x = w[:, :, j]; v = np.diff(x, axis=1) * hz
        q75, q25 = np.percentile(x, [75, 25], axis=1)
        cols = [x.std(1), x.max(1) - x.min(1), q75 - q25, np.abs(v).mean(1), np.percentile(np.abs(v), 95, axis=1)]
        if with_abs:
            cols.append(x.mean(1))
        feats.append(np.stack(cols, 1))
    return np.concatenate(feats, 1)


def stat_names(names, with_abs):
    base = ["std", "range", "iqr", "mean|v|", "p95|v|"] + (["mean"] if with_abs else [])
    return [f"{n}:{b}" for n in names for b in base]


def lr_cv(data, dev, cfg, with_abs, seed, model_kind="lr"):
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    def mk():
        return LogisticRegression(C=0.3, class_weight="balanced", max_iter=2000) if model_kind == "lr" else \
            GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.05, subsample=0.8, random_state=seed)
    folds = []
    for tr, te in dasd.stratified_participant_folds(dev, T.N_FOLDS, seed):
        X, y, _, w = T.stack(data, tr)
        S = summarize(X, cfg.feature_names, cfg.resample_hz, with_abs); sc = StandardScaler().fit(S)
        m = mk()
        (m.fit(sc.transform(S), y, sample_weight=w) if model_kind == "gb" else m.fit(sc.transform(S), y, sample_weight=w))
        ids, lab, pr = [], [], []
        for r in te:
            l, ww = data[r.participant_id]
            if len(ww) == 0: continue
            ids.append(r.participant_id); lab.append(l)
            pr.append(float(m.predict_proba(sc.transform(summarize(ww, cfg.feature_names, cfg.resample_hz, with_abs)))[:, 1].mean()))
        folds.append(T.participant_metrics(ids, lab, pr))
    return folds


def lr_fit_full(data, dev, cfg, with_abs):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    X, y, _, w = T.stack(data, dev)
    S = summarize(X, cfg.feature_names, cfg.resample_hz, with_abs); sc = StandardScaler().fit(S)
    m = LogisticRegression(C=0.3, class_weight="balanced", max_iter=2000).fit(sc.transform(S), y, sample_weight=w)
    return m, sc


def main():
    recs = dasd.discover(); dev, _test = dasd.official_split(recs)      # test split is never read below
    web_raw = [pd.read_csv(f) for f in sorted(WEB_DIR.glob("*.csv"))]
    slopes = fit_slopes(dev)
    base = dataclasses.replace(C.PreprocessConfig(), head_slopes=slopes)
    def cfg(names, **kw): return dataclasses.replace(base, feature_names=tuple(names), **kw)
    lstm = {
        "A gaze only": cfg(G2),
        "B gaze+vel": cfg(G2 + V2),
        "C gaze+head": cfg(G2 + H3),
        "D all 7 (current)": cfg(G2 + V2 + H3),
        "D + session-centred": cfg(G2 + V2 + H3, center_session=True),
        "E head only": cfg(H3),
        "F eye-in-head only (rel gaze + vel)": cfg(R2 + RV2),
        "G eye-in-head + head pose": cfg(R2 + RV2 + H3),
        "G + session-centred": cfg(R2 + RV2 + H3, center_session=True),
        "F + session-centred": cfg(R2 + RV2, center_session=True),
    }
    res = {"head_slopes_fit_on_dev": slopes, "lstm": {}, "summary": {}}
    for name, c in lstm.items():
        data = T.load_windows(dev, c)
        folds = [T.cross_validate(data, dev, c, s) for s in SEEDS]
        a = agg(folds)
        full, norm, _h, _e = T.fit(data, dev, c, 7, epochs=15)
        res["lstm"][name] = {"cv": a, "features": list(c.feature_names), "center_session": c.center_session,
                             "coverage": coverage(c, dev, web_raw), "webcam_probability_final_fit": webcam_probs(full, norm, c, web_raw)}
        print(f"[LSTM] {name:38s} AUC {a['roc_auc']['mean']:.3f} ±{a['roc_auc']['sd_over_folds']:.3f}  acc {a['accuracy']['mean']:.3f}  sens {a['recall_sensitivity']['mean']:.3f} spec {a['specificity']['mean']:.3f} | "
              f"cov(std in-range) {res['lstm'][name]['coverage']['std_inside_range']:.2f}  webcam p={res['lstm'][name]['webcam_probability_final_fit']}", flush=True)
    pos = {"S1 5ch abs+motion (LR)": (cfg(G2 + H3), True, "lr"), "S2 5ch motion-only (LR)": (cfg(G2 + H3), False, "lr"),
           "S3 gaze-only abs+motion (LR)": (cfg(G2), True, "lr"), "S4 head-only motion (LR)": (cfg(H3), False, "lr"),
           "S5 eye-in-head motion (LR)": (cfg(R2), False, "lr"), "S6 eye-in-head + head motion (LR)": (cfg(R2 + H3), False, "lr"),
           "S7 5ch motion-only (GB)": (cfg(G2 + H3), False, "gb"), "S8 5ch abs+motion (GB)": (cfg(G2 + H3), True, "gb")}
    for name, (c, ab, kind) in pos.items():
        data = T.load_windows(dev, c)
        folds = [lr_cv(data, dev, c, ab, s, kind) for s in SEEDS]
        a = agg(folds)
        entry = {"cv": a, "features": list(c.feature_names), "with_abs": ab, "model": kind, "coverage": coverage(c, dev, web_raw)}
        if kind == "lr":
            m, sc = lr_fit_full(data, dev, c, ab)
            names = stat_names(c.feature_names, ab)
            entry["top_coefficients"] = sorted(zip(names, m.coef_[0].round(2).tolist()), key=lambda t: -abs(t[1]))[:6]
            entry["webcam_probability_final_fit"] = [round(float(m.predict_proba(sc.transform(summarize(P.prepare_session(x, c).windows, c.feature_names, c.resample_hz, ab)))[:, 1].mean()), 3) for x in web_raw]
        res["summary"][name] = entry
        print(f"[SUM ] {name:38s} AUC {a['roc_auc']['mean']:.3f} ±{a['roc_auc']['sd_over_folds']:.3f}  acc {a['accuracy']['mean']:.3f}  sens {a['recall_sensitivity']['mean']:.3f} spec {a['specificity']['mean']:.3f} | "
              f"cov(std in-range) {entry['coverage']['std_inside_range']:.2f}  webcam p={entry.get('webcam_probability_final_fit')}", flush=True)
    (OUT / "experiments.json").write_text(json.dumps(res, indent=1, default=float))


if __name__ == "__main__":
    main()
