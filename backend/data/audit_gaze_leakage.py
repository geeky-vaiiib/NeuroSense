"""Recording-context / duration leakage audit for the gaze model (development children only).

    python -m backend.data.audit_gaze_leakage

PRE-DECLARED DECISION RULE (fixed before the first run).  v3 is said to show evidence of learning
gaze-related patterns beyond collection context only if ALL of:
  (1) participant-level paired bootstrap 95% CI of  AUC(v3) - AUC(best metadata-only control)  is > 0;
  (2) the donor-swap control (other children's gaze placed on each child's own timeline, holes and
      length, labels kept) has an AUC whose 95% CI includes 0.5;
  (3) duration-equalised variants (every child cropped to the same 7 s) keep an AUC clearly above
      the metadata controls evaluated on the same children;
  (4) the label-permutation control gives AUC ~0.5.
Only the 55 official-train children are loaded for any modelling; the examined test split is not read.
Identical folds everywhere: stratified participant-level 5-fold x 10 repeats (seeds 101..110).
"""

from __future__ import annotations

import dataclasses
import json
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.data import train_gaze_openface_dasd as T  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports" / "leakage_audit"
SEEDS = tuple(range(101, 111))
CFG = C.MODEL_CONFIGS["gaze-openface-dasd-v3"]
CROP_STEPS = 70                       # 7 s: every child (shortest = 7.16 s) has at least this much
N_BOOT = 2000


# ───────────────────────────── metadata per child ──────────────────────────────
def metadata_row(rec, prep) -> dict:
    raw = dasd.read_csv(rec).rename(columns=str.strip)
    t = raw.timestamp.to_numpy(float); dt = np.diff(t)
    rs = prep.resampled; hole = rs.hole; L, S = CFG.window_steps, CFG.stride_steps
    # fraction of each window's steps that had to be filled (no real frame within 0.25 s)
    hf = [hole[a:a + L].mean() for a in range(0, len(hole) - L + 1, S)]
    conf = raw.confidence.to_numpy(float)
    return {"id": rec.participant_id, "label": rec.label,
            "duration_s": float(t[-1] - t[0]), "n_frames": int(len(raw)), "fps": float((len(raw) - 1) / (t[-1] - t[0])),
            "dt_median_s": float(np.median(dt)), "max_gap_s": float(dt.max()), "gap_ratio": float((dt > C.MAX_GAP_S).mean()),
            "grid_steps": int(len(hole)), "hole_fraction": float(hole.mean()), "n_windows": int(len(prep.windows)),
            "window_fill_fraction_mean": float(np.mean(hf)) if hf else 0.0,
            "windows_with_any_fill": float(np.mean(np.array(hf) > 0)) if hf else 0.0,
            "conf_mean": float(conf.mean()), "conf_p05": float(np.percentile(conf, 5)), "conf_cap_share": float((conf >= 0.98).mean()),
            "valid_frame_ratio": float(prep.cleaned.n_valid / prep.cleaned.n_total), "first_timestamp_s": float(t[0])}


def auc_ci(y, x, rng):
    from sklearn.metrics import roc_auc_score
    a = roc_auc_score(y, x); b = []
    for _ in range(N_BOOT):
        i = rng.integers(0, len(y), len(y))
        if len(set(y[i])) == 2:
            b.append(roc_auc_score(y[i], x[i]))
    return float(a), [float(np.percentile(b, 2.5)), float(np.percentile(b, 97.5))]


# ───────────────────────────── CV helpers ──────────────────────────────────────
def folds_for(dev, seed):
    return list(dasd.stratified_participant_folds(dev, T.N_FOLDS, seed))


def cv_bilstm(data, dev, seed):
    from sklearn.metrics import roc_auc_score
    oof, fold_rows = {}, []
    for k, (tr, te) in enumerate(folds_for(dev, seed)):
        tr = [r for r in tr if len(data[r.participant_id][1])]; te = [r for r in te if len(data[r.participant_id][1])]
        tr2, va = dasd.holdout_split(tr, 0.15, seed + k)
        model, norm, _h, _e = T.fit(data, tr2, CFG, seed + k, val_recs=va)
        ids, y, p = T.participant_probs(model, norm, data, te)
        oof.update(dict(zip(ids, p)))
        fold_rows.append({"seed": seed, "fold": k, "n": len(ids),
                          "auc": float(roc_auc_score(y, p)) if len(set(y)) == 2 else None,
                          "acc": float(np.mean((np.array(p) >= .5) == np.array(y)))})
    return oof, fold_rows


def cv_tabular(kind, feats, dev, seed):
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.preprocessing import StandardScaler
    from sklearn.utils.class_weight import compute_sample_weight
    oof, fold_rows = {}, []
    for k, (tr, te) in enumerate(folds_for(dev, seed)):
        X = np.array([feats[r.participant_id] for r in tr]); y = np.array([r.label for r in tr])
        sc = StandardScaler().fit(X)
        if kind == "LR":
            m = LogisticRegression(C=0.3, class_weight="balanced", max_iter=5000).fit(sc.transform(X), y)
        else:
            m = GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05, subsample=0.8, random_state=seed)
            m.fit(sc.transform(X), y, sample_weight=compute_sample_weight("balanced", y))
        p = m.predict_proba(sc.transform(np.array([feats[r.participant_id] for r in te])))[:, 1]
        yt = [r.label for r in te]
        oof.update({r.participant_id: float(q) for r, q in zip(te, p)})
        fold_rows.append({"seed": seed, "fold": k, "n": len(te), "auc": float(roc_auc_score(yt, p)), "acc": float(np.mean((p >= .5) == np.array(yt)))})
    return oof, fold_rows


def summarize(name, oofs, folds, labels, rng):
    from sklearn.metrics import roc_auc_score
    reps = []
    for o in oofs:
        ids = sorted(o); y = np.array([labels[i] for i in ids]); p = np.array([o[i] for i in ids])
        pred = p >= .5
        reps.append({"auc": roc_auc_score(y, p), "acc": float((pred == y).mean()), "sens": float(pred[y == 1].mean()), "spec": float((~pred[y == 0]).mean())})
    ids = sorted(oofs[0]); mean_p = np.array([np.mean([o[i] for o in oofs]) for i in ids]); y = np.array([labels[i] for i in ids])
    a, ci = auc_ci(y, mean_p, rng)
    fa = [f["auc"] for f in folds if f["auc"] is not None]
    return {"name": name, "n_children": len(ids),
            **{m: {"mean": float(np.mean([r[m] for r in reps])), "sd_repeats": float(np.std([r[m] for r in reps]))} for m in ("auc", "acc", "sens", "spec")},
            "auc_of_repeat_averaged_oof": a, "auc_ci95": ci,
            "fold_auc": {"mean": float(np.mean(fa)), "sd": float(np.std(fa)), "min": float(np.min(fa)), "max": float(np.max(fa)), "n_folds": len(fa)},
            "folds": folds, "_oof_mean": dict(zip(ids, mean_p.tolist()))}


# ───────────────────────────── data variants ───────────────────────────────────
def windows_from(rs, start=0, n=None, grid_override=None):
    n = n if n is not None else len(rs.hole) - start
    sl = slice(start, start + n)
    grid = {k: (grid_override[k] if grid_override else v)[sl] for k, v in rs.grid.items()}
    rs2 = P.Resampled(grid, rs.hole[sl], rs.hz)
    feats = P.build_features(rs2, CFG)                    # session-centring uses ONLY the cropped segment
    return P.make_windows(feats, rs2.hole, CFG)


def donor_grid(rs, donors, rng):
    """Recipient's own timeline and holes, gaze content from a random other child (tiled to length)."""
    valid = np.isfinite(rs.grid["gaze_angle_x"]) & np.isfinite(rs.grid["gaze_angle_y"])
    don = donors[rng.integers(len(donors))]
    dv = np.stack([don.grid["gaze_angle_x"], don.grid["gaze_angle_y"]], 1); dv = dv[np.isfinite(dv).all(1)]
    take = dv[np.arange(valid.sum()) % len(dv)]
    g = {k: np.full_like(v, np.nan) for k, v in rs.grid.items()}
    g["gaze_angle_x"][valid] = take[:, 0]; g["gaze_angle_y"][valid] = take[:, 1]
    return g


def shuffled_grid(rs, rng):
    valid = np.isfinite(rs.grid["gaze_angle_x"]) & np.isfinite(rs.grid["gaze_angle_y"])
    idx = np.flatnonzero(valid); perm = rng.permutation(len(idx))
    g = {k: v.copy() for k, v in rs.grid.items()}
    for k in ("gaze_angle_x", "gaze_angle_y"):
        g[k][idx] = rs.grid[k][idx][perm]
    return g


def even_subset(wins, n=3):
    if len(wins) <= n:
        return wins
    return wins[np.linspace(0, len(wins) - 1, n).round().astype(int)]


def main():
    t0 = time.time(); OUT.mkdir(parents=True, exist_ok=True)
    recs = dasd.discover(); dev, _unused_test = dasd.official_split(recs)           # test split never read
    labels = {r.participant_id: r.label for r in dev}
    rng = np.random.default_rng(0)
    prepped = {r.participant_id: P.prepare_session(dasd.read_csv(r), CFG) for r in dev}
    res: dict = {"seeds": SEEDS, "n_dev": len(dev), "decision_rule": __doc__.split("PRE-DECLARED")[1].split("Only the 55")[0].strip()}

    # ── 1. metadata audit ───────────────────────────────────────────────────────
    meta = pd.DataFrame([metadata_row(r, prepped[r.participant_id]) for r in dev])
    meta.to_csv(OUT / "dev_metadata.csv", index=False)
    from scipy.stats import mannwhitneyu
    audit = {}
    y = meta.label.to_numpy()
    for c in [c for c in meta.columns if c not in ("id", "label")]:
        x = meta[c].to_numpy(float)
        if np.ptp(x) == 0:
            audit[c] = {"constant": True}; continue
        a, ci = auc_ci(y, x, rng); u = mannwhitneyu(x[y == 1], x[y == 0])
        audit[c] = {"ASD_median": float(np.median(x[y == 1])), "TD_median": float(np.median(x[y == 0])),
                    "ASD_iqr": [float(np.percentile(x[y == 1], 25)), float(np.percentile(x[y == 1], 75))],
                    "TD_iqr": [float(np.percentile(x[y == 0], 25)), float(np.percentile(x[y == 0], 75))],
                    "auc_ASD_higher": a, "auc_ci95": ci, "mannwhitney_p": float(u.pvalue)}
    res["metadata_audit"] = audit
    # recording-boundary check: first 6 s vs the rest (movement SD of gaze x), by class
    def seg_sd(rs, a, b):
        x = rs.grid["gaze_angle_x"][a:b]; x = x[np.isfinite(x)]
        return float(x.std()) if len(x) > 5 else np.nan
    first = np.array([seg_sd(prepped[r.participant_id].resampled, 0, 60) for r in dev])
    rest = np.array([seg_sd(prepped[r.participant_id].resampled, 60, None) for r in dev])
    res["boundary_check_gaze_x_sd"] = {"first6s_median_ASD": float(np.nanmedian(first[y == 1])), "first6s_median_TD": float(np.nanmedian(first[y == 0])),
                                       "rest_median_ASD": float(np.nanmedian(rest[y == 1])), "rest_median_TD": float(np.nanmedian(rest[y == 0])),
                                       "first_over_rest_ratio_ASD": float(np.nanmedian(first[y == 1] / rest[y == 1])),
                                       "first_over_rest_ratio_TD": float(np.nanmedian(first[y == 0] / rest[y == 0]))}
    print("metadata audit done", flush=True)

    # ── 3. metadata-only negative controls (same folds) ─────────────────────────
    sets = {"duration only": ["duration_s"], "length (duration, frames, windows, grid steps)": ["duration_s", "n_frames", "n_windows", "grid_steps"],
            "frame rate / timing": ["fps", "dt_median_s", "max_gap_s"], "missingness (gaps, holes, fills)": ["gap_ratio", "hole_fraction", "window_fill_fraction_mean", "windows_with_any_fill", "max_gap_s"],
            "tracking confidence": ["conf_mean", "conf_p05", "conf_cap_share"],
            "ALL metadata": ["duration_s", "n_frames", "fps", "dt_median_s", "max_gap_s", "gap_ratio", "grid_steps", "hole_fraction", "n_windows",
                             "window_fill_fraction_mean", "windows_with_any_fill", "conf_mean", "conf_p05", "conf_cap_share", "first_timestamp_s"]}
    CACHE = OUT / "summ_cache.pkl"
    summ = pickle.loads(CACHE.read_bytes()) if CACHE.exists() else {}
    def save(): CACHE.write_bytes(pickle.dumps(summ))
    for nm, cols in sets.items():
        feats = {row.id: np.array([row[c] for c in cols], float) for _, row in meta.iterrows()}
        for kind in ("LR", "GB"):
            if f"metadata-only {kind}: {nm}" in summ: continue
            oofs, folds = [], []
            for sd in SEEDS:
                o, f = cv_tabular(kind, feats, dev, sd); oofs.append(o); folds += f
            summ[f"metadata-only {kind}: {nm}"] = summarize(f"metadata-only {kind}: {nm}", oofs, folds, labels, rng)
            print(f"metadata {kind:2s} {nm:45s} AUC {summ[f'metadata-only {kind}: {nm}']['auc']['mean']:.3f}", flush=True); save()

    # ── 5. gaze (BiLSTM) variants, identical folds ──────────────────────────────
    donors = [p.resampled for p in prepped.values()]
    def build(kind, seed):
        r = np.random.default_rng(seed); out = {}
        for rec in dev:
            rs = prepped[rec.participant_id].resampled; n = len(rs.hole)
            if kind == "v3 (full session, as deployed)":
                w = prepped[rec.participant_id].windows
            elif kind == "crop first 7 s":
                w = windows_from(rs, 0, CROP_STEPS)
            elif kind == "crop last 7 s":
                w = windows_from(rs, n - CROP_STEPS, CROP_STEPS)
            elif kind == "crop middle 7 s":
                w = windows_from(rs, (n - CROP_STEPS) // 2, CROP_STEPS)
            elif kind == "3 evenly spaced windows":
                w = even_subset(prepped[rec.participant_id].windows, 3)
            elif kind == "window-centred (no session mean)":
                w = P.make_windows(P.build_features(rs, dataclasses.replace(CFG, center_session=False)), rs.hole,
                                   dataclasses.replace(CFG, center_session=False, center_window=True))
            elif kind == "DONOR SWAP (others' gaze, own timeline/holes/length)":
                w = windows_from(rs, 0, None, donor_grid(rs, [d for d in donors if d is not rs], r))
            elif kind == "TIME-SHUFFLED within child (order removed)":
                w = windows_from(rs, 0, None, shuffled_grid(rs, r))
            else:
                raise KeyError(kind)
            out[rec.participant_id] = (rec.label, w)
        return out
    variants = ["v3 (full session, as deployed)", "crop first 7 s", "crop last 7 s", "crop middle 7 s", "3 evenly spaced windows",
                "window-centred (no session mean)", "DONOR SWAP (others' gaze, own timeline/holes/length)", "TIME-SHUFFLED within child (order removed)"]
    for v in variants:
        if v in summ: continue
        oofs, folds = [], []; tt = time.time()
        static = build(v, 0) if not (v.startswith("DONOR") or v.startswith("TIME")) else None
        for sd in SEEDS:
            data = static if static is not None else build(v, sd)
            o, f = cv_bilstm(data, dev, sd); oofs.append(o); folds += f
        summ[v] = summarize(v, oofs, folds, labels, rng)
        print(f"BiLSTM  {v:55s} AUC {summ[v]['auc']['mean']:.3f}±{summ[v]['auc']['sd_repeats']:.3f} n={summ[v]['n_children']}  ({time.time() - tt:.0f}s)", flush=True); save()
    # label permutation (pipeline sanity): permute labels among children, same folds logic
    LP = "LABEL PERMUTATION (pipeline sanity)"
    if LP not in summ:
        from sklearn.metrics import roc_auc_score
        oofs, folds = [], []
        base = build("v3 (full session, as deployed)", 0)
        for sd in SEEDS:
            r = np.random.default_rng(sd); perm = r.permutation([x.label for x in dev])
            pdev = [dataclasses.replace(x, label=int(l)) for x, l in zip(dev, perm)]
            pdata = {x.participant_id: (x.label, base[x.participant_id][1]) for x in pdev}
            o, f = cv_bilstm(pdata, pdev, sd); oofs.append((o, {x.participant_id: x.label for x in pdev})); folds += f
        aucs = [roc_auc_score([lb[i] for i in sorted(o)], [o[i] for i in sorted(o)]) for o, lb in oofs]
        summ[LP] = {"name": LP, "auc": {"mean": float(np.mean(aucs)), "sd_repeats": float(np.std(aucs))},
                    "auc_each_permutation": [float(a) for a in aucs], "folds": folds, "n_children": len(dev)}
        save()
    print(f"label permutation AUC mean {summ[LP]['auc']['mean']:.3f} sd {summ[LP]['auc']['sd_repeats']:.3f}", flush=True)
    from sklearn.metrics import roc_auc_score

    # ── paired comparisons against v3, participant bootstrap ────────────────────
    base_k = "v3 (full session, as deployed)"
    ids_all = sorted(labels)
    def paired(a_k, b_k):
        ids = [i for i in ids_all if i in summ[a_k]["_oof_mean"] and i in summ[b_k]["_oof_mean"]]
        yv = np.array([labels[i] for i in ids]); pa = np.array([summ[a_k]["_oof_mean"][i] for i in ids]); pb = np.array([summ[b_k]["_oof_mean"][i] for i in ids])
        d = []
        for _ in range(N_BOOT):
            ix = rng.integers(0, len(ids), len(ids))
            if len(set(yv[ix])) == 2:
                d.append(roc_auc_score(yv[ix], pa[ix]) - roc_auc_score(yv[ix], pb[ix]))
        return {"n": len(ids), "diff": float(roc_auc_score(yv, pa) - roc_auc_score(yv, pb)), "ci95": [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))]}
    meta_keys = [k for k in summ if k.startswith("metadata-only")]
    res["paired_v3_minus"] = {k: paired(base_k, k) for k in meta_keys + [v for v in variants if v != base_k]}
    for v in variants[1:5]:
        res.setdefault("paired_variant_minus_metadata_same_children", {})[v] = {k: paired(v, k) for k in ("metadata-only GB: ALL metadata", "metadata-only LR: duration only")}

    # ── duration/fps-matched subsets, using v3's own out-of-fold predictions ────
    mi = meta.set_index("id"); dur = mi.duration_s; fps = mi.fps; lab = mi.label
    lo, hi = max(dur[lab == 1].min(), dur[lab == 0].min()), min(dur[lab == 1].max(), dur[lab == 0].max())
    sub = [i for i in ids_all if lo <= dur[i] <= hi]
    flo, fhi = max(fps[lab == 1].min(), fps[lab == 0].min()), min(fps[lab == 1].max(), fps[lab == 0].max())
    sub2 = [i for i in sub if flo <= fps[i] <= fhi]
    def sub_auc(ids):
        yv = np.array([labels[i] for i in ids]); r = {}
        for nm, vec in (("v3 OOF probability", [summ[base_k]["_oof_mean"][i] for i in ids]), ("duration", [dur[i] for i in ids]), ("fps", [fps[i] for i in ids])):
            a, ci = auc_ci(yv, np.array(vec, float), rng); r[nm] = {"auc": a, "ci95": ci}
        r["n"] = len(ids); r["ASD"] = int(yv.sum()); r["TD"] = int(len(yv) - yv.sum()); return r
    res["matched_subsets"] = {"duration_overlap": {"range_s": [float(lo), float(hi)], **sub_auc(sub)},
                              "duration_and_fps_overlap": {"fps_range": [float(flo), float(fhi)], **sub_auc(sub2)}}
    for v in summ.values():
        v.pop("_oof_mean", None)
    res["results"] = summ; res["seconds"] = round(time.time() - t0)
    (OUT / "leakage_audit.json").write_text(json.dumps(res, indent=1, default=float))
    print("done", res["seconds"], "s")


if __name__ == "__main__":
    main()
