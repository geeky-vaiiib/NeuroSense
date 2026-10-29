"""Audit: are the questionnaire training labels independent of the questionnaire items?

    python -m backend.data.audit_questionnaire_labels

For each category (adult, child, toddler) it reports
  1. how exactly a threshold on the item total reproduces the class label,
  2. what an item-free model (demographics / history only) can achieve with participant-level-style CV,
  3. whether the SHIPPED model's predictions are a function of the item total alone.
Writes backend/reports/questionnaire_label_audit.json.  No labels are invented or changed.
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import train_model as TM  # noqa: E402
from backend.ml.config import CATEGORY_MODEL_CONFIG  # noqa: E402

warnings.filterwarnings("ignore")
OUT = Path(__file__).resolve().parents[1] / "reports" / "questionnaire_label_audit.json"
PUBLISHED = {c: "dataset providers' labelling rule; the instrument manual's own cut-off may differ - verify before clinical use"
             for c in ("adult", "child", "toddler")}


def _dataset_path(category: str) -> str:
    for p in CATEGORY_MODEL_CONFIG[category]["dataset_paths"]:
        if Path(p).exists():
            return str(p)
    raise FileNotFoundError(f"no dataset for {category}")


def audit(category: str) -> dict:
    import io, contextlib
    path = _dataset_path(category)
    with contextlib.redirect_stdout(io.StringIO()):
        if category == "toddler":
            # train_model handles the toddler schema inside its CLI; mirror only what the audit needs
            raw = pd.read_csv(path); raw.columns = raw.columns.str.strip()
            items = [f"A{i}" for i in range(1, 11)]
            label = [c for c in raw.columns if c.lower().startswith("class")][0]
            y = raw[label].astype(str).str.strip().str.upper().isin(["YES", "1", "TRUE"]).astype(int).to_numpy()
            total = raw[items].sum(axis=1).to_numpy()
            demo = raw[[c for c in ("Age_Mons", "Sex", "Jaundice", "Family_mem_with_ASD", "Ethnicity") if c in raw.columns]].copy()
        else:
            df = TM.load_and_clean(path, category)
            items = TM.AQ_COLS
            y = df["target"].to_numpy(); total = df[items].sum(axis=1).to_numpy()
            demo = df[[c for c in ["age"] + TM.CATEGORICAL_FEATURES if c in df.columns]].copy()
    res = {"dataset": path, "rows": int(len(y)), "positive_rate": float(y.mean()), "published_cutoff": PUBLISHED[category]}
    rule = {t: float(((total >= t).astype(int) == y).mean()) for t in range(0, 11)}
    best = max(rule, key=rule.get)
    res["threshold_rule"] = {"best_threshold_total_ge": int(best), "agreement": rule[best], "neighbours": {str(t): rule[t] for t in (best - 1, best + 1) if t in rule},
                             "rows_disagreeing": int(round((1 - rule[best]) * len(y)))}
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import roc_auc_score
    skf = StratifiedKFold(5, shuffle=True, random_state=0)
    # item-free model: demographics / history only
    d = demo.copy()
    for c in d.columns:
        if d[c].dtype == object:
            d[c] = d[c].astype(str).astype("category").cat.codes
    d = d.fillna(d.median(numeric_only=True))
    p = cross_val_predict(GradientBoostingClassifier(random_state=0), d.to_numpy(), y, cv=skf, method="predict_proba")[:, 1]
    res["item_free_model_cv"] = {"features": list(d.columns), "auc": float(roc_auc_score(y, p)), "accuracy": float(((p >= .5) == y).mean())}
    res["total_alone_auc"] = float(roc_auc_score(y, total))
    # shipped model: is its output a function of the total alone?
    mpath = CATEGORY_MODEL_CONFIG[category]["model_path"]
    if Path(mpath).exists():
        model = joblib.load(mpath)
        if category == "toddler":      # rebuild the 15-feature matrix with the SAVED encoders, in the training order
            enc = joblib.load(CATEGORY_MODEL_CONFIG["toddler"]["encoders_path"])
            raw = pd.read_csv(path); raw.columns = raw.columns.str.strip()
            def e(name, col):
                v = raw[col].astype(str).str.strip(); v = v.str.lower() if name in ("gender", "jaundice", "family_asd") else v
                known = set(enc[name].classes_); return enc[name].transform(v.where(v.isin(known), enc[name].classes_[0]))
            X = np.column_stack([raw[[f"A{i}" for i in range(1, 11)]].to_numpy(float), raw["Age_Mons"].to_numpy(float),
                                 e("gender", "Sex"), e("jaundice", "Jaundice"), e("family_asd", "Family_mem_with_ASD"), e("ethnicity", "Ethnicity")])
            y2 = y
        else:
            with contextlib.redirect_stdout(io.StringIO()):
                df2 = TM.load_and_clean(path, category); df2, _ = TM.encode_features(df2); X, y2 = TM.build_feature_matrix(df2)
        if X.shape[1] == getattr(model, "n_features_in_", X.shape[1]):
            pr = model.predict_proba(X)[:, 1]; pred = (pr >= .5).astype(int)
            by = pd.DataFrame({"total": X[:, :10].sum(1), "p": pr, "pred": pred})
            g = by.groupby("total")
            res["shipped_model"] = {"agrees_with_threshold_rule": float((pred == (X[:, :10].sum(1) >= best)).mean()),
                                    "agrees_with_label": float((pred == y2).mean()),
                                    "within_total_max_probability_range": float((g.p.max() - g.p.min()).max()),
                                    "within_total_mean_probability_std": float(g.p.std().fillna(0).mean()),
                                    "variance_of_probability_explained_by_total": float(1 - (by.p - g.p.transform("mean")).var() / by.p.var())}
    return res


def main():
    out = {c: audit(c) for c in ("adult", "child", "toddler")}
    OUT.parent.mkdir(exist_ok=True); OUT.write_text(json.dumps(out, indent=1, default=float))
    for c, r in out.items():
        t = r["threshold_rule"]
        print(f"{c:8s} n={r['rows']:5d}  total>={t['best_threshold_total_ge']} reproduces the label for {100 * t['agreement']:.1f}% of rows ({t['rows_disagreeing']} disagree) | "
              f"total-only AUC {r['total_alone_auc']:.3f} | item-free model AUC {r['item_free_model_cv']['auc']:.3f} ")
        if "shipped_model" in r:
            s = r["shipped_model"]
            print(f"         shipped model: agrees with threshold rule {100 * s['agrees_with_threshold_rule']:.1f}%, with label {100 * s['agrees_with_label']:.1f}%; "
                  f"variance of its probability explained by the total {100 * s['variance_of_probability_explained_by_total']:.1f}%; max P-range within one total {s['within_total_max_probability_range']:.3f}")
    return out


if __name__ == "__main__":
    main()
