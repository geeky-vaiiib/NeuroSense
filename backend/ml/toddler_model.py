"""The toddler questionnaire model: checkpoint format, loading, inference and explanation (single implementation).

Checkpoint directory (never overwritten; versioned by directory name):
  metadata.json   provenance (dataset + citation, features/order, response encoding, split, CV, hyper-parameters, metrics, ...)
  model.json      logistic-regression checkpoint as plain numbers (imputer medians, scaler, coefficients)  -- or --
  model.joblib    scikit-learn pipeline for tree/forest/boosting/SVC (sha256 recorded in metadata; verified before loading)
  background.npy  reference sample of development-set feature rows for explanations
Training (backend/data/train_toddler_qchat.py) and inference both use ``features_from_recodes`` so the feature order is identical.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

import numpy as np

try:
    from . import qchat10 as Q
except ImportError:  # pragma: no cover
    from ml import qchat10 as Q

DEFAULT_DIR = Path(__file__).resolve().parents[1] / "models" / "toddler_qchat10_polish_v1"
EXTRA_FEATURES = ("age_months", "female")


class ModelUnavailable(RuntimeError):
    pass


def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def save_checkpoint(directory: Path, pipeline, cols: list[str], meta: dict, background) -> None:
    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    names = [n for n, _ in pipeline.steps]
    if names == ["simpleimputer", "standardscaler", "logisticregression"]:
        imp, sc, lr = (pipeline.named_steps[n] for n in names)
        (directory / "model.json").write_text(json.dumps({
            "kind": "logistic_regression", "feature_names": cols, "impute_median": imp.statistics_.tolist(),
            "scale_mean": sc.mean_.tolist(), "scale_std": sc.scale_.tolist(), "coef": lr.coef_[0].tolist(), "intercept": float(lr.intercept_[0])}, indent=1))
        meta["model_file"] = {"name": "model.json", "sha256": _sha256(directory / "model.json"), "format": "plain JSON numbers (no pickle)"}
    else:
        import joblib
        joblib.dump(pipeline, directory / "model.joblib")
        meta["model_file"] = {"name": "model.joblib", "sha256": _sha256(directory / "model.joblib"), "format": "scikit-learn pickle, hash-verified"}
    np.save(directory / "background.npy", np.asarray(background[cols], dtype=float))
    (directory / "metadata.json").write_text(json.dumps(meta, indent=1, default=float))


class ToddlerModel:
    def __init__(self, directory: Path):
        d = Path(directory)
        self.meta = json.loads((d / "metadata.json").read_text())
        self.cols: list[str] = list(self.meta["feature_names"])
        mf = self.meta["model_file"]
        path = d / mf["name"]
        if _sha256(path) != mf["sha256"]:
            raise ModelUnavailable("checkpoint file does not match its recorded sha256")
        self.background = np.load(d / "background.npy")
        if mf["name"].endswith(".json"):
            p = json.loads(path.read_text())
            self.kind = "linear"
            self.coef, self.intercept = np.asarray(p["coef"]), float(p["intercept"])
            self.median, self.mean, self.std = (np.asarray(p[k]) for k in ("impute_median", "scale_mean", "scale_std"))
            if p["feature_names"] != self.cols or len(self.coef) != len(self.cols):
                raise ModelUnavailable("checkpoint feature list disagrees with its metadata")
        else:
            import joblib
            self.pipeline = joblib.load(path)
            self.kind = "sklearn"
        self.version = self.meta["model_version"]
        self.threshold = float(self.meta["decision_threshold"])

    # ── features (identical to training) ──
    def features(self, recodes: list[int], age_months: Optional[int] = None, female: Optional[bool] = None) -> np.ndarray:
        if len(recodes) != len(Q.FEATURE_NAMES):
            raise ValueError("expected the ten Q-CHAT-10 recoded values")
        row = dict(zip(Q.FEATURE_NAMES, map(float, recodes)))
        if "age_months" in self.cols:
            if age_months is None:
                raise ValueError("this model needs age in months")
            row["age_months"] = float(age_months)
        if "female" in self.cols:
            if female is None:
                raise ValueError("this model needs sex")
            row["female"] = float(bool(female))
        extra = [c for c in self.cols if c not in row]
        if extra:
            raise ModelUnavailable(f"model needs variables NeuroSense does not collect: {extra}")
        return np.array([[row[c] for c in self.cols]], dtype=float)

    def predict_proba(self, X: np.ndarray) -> float:
        if self.kind == "linear":
            z = ((np.where(np.isnan(X), self.median, X) - self.mean) / self.std) @ self.coef + self.intercept
            return float(1.0 / (1.0 + np.exp(-z[0])))
        return float(self.pipeline.predict_proba(X)[0, 1])

    # ── explanation (SHAP for the model actually loaded) ──
    def explain(self, X: np.ndarray) -> dict:
        """Local SHAP values (log-odds for the linear model, model-output units for others) relative to the development-set reference."""
        if self.kind == "linear":
            ref = self.background.mean(axis=0)
            contrib = self.coef * ((X[0] - ref) / self.std)
            base = float(self.intercept + (((ref - self.mean) / self.std) @ self.coef))
            method = "exact linear SHAP (independent features), log-odds; reference = mean of the stored development sample"
        else:
            import shap
            est = self.pipeline.steps[-1][1]; pre = self.pipeline[:-1]
            Xt, Bt = pre.transform(X), pre.transform(self.background)
            if type(est).__name__ in ("RandomForestClassifier", "GradientBoostingClassifier", "DecisionTreeClassifier"):
                sv = shap.TreeExplainer(est).shap_values(Xt); base = None
                method = "TreeExplainer (model-output units of the positive class)"
            else:
                ex = shap.KernelExplainer(lambda a: est.predict_proba(a)[:, 1], shap.sample(Bt, min(50, len(Bt)), random_state=0))
                sv = ex.shap_values(Xt, silent=True); base = float(ex.expected_value)
                method = "KernelExplainer against the stored development sample"
            sv = np.asarray(sv[1] if isinstance(sv, list) else sv)
            contrib = (sv[:, :, 1] if sv.ndim == 3 else sv)[0]
        items = []
        for i, c in enumerate(self.cols):
            name = next((it.short for it in Q.ITEMS if it.dataset_column.replace("recode", "") == c), {"age_months": "Age (months)", "female": "Sex (female)"}.get(c, c))
            items.append({"feature": c, "label": name, "value": float(X[0, i]), "contribution": round(float(contrib[i]), 4),
                          "direction": "toward the ASD-group pattern" if contrib[i] > 0 else "toward the control-group pattern"})
        items.sort(key=lambda r: abs(r["contribution"]), reverse=True)
        return {"method": method, "base_value": base, "items": items,
                "note": "Association within this cohort's responses, not causation and not a statement about this child's cause or diagnosis."}


_cache: dict = {}


def load_model(directory: Path = DEFAULT_DIR) -> ToddlerModel:
    key = str(directory)
    if key not in _cache:
        if not (Path(directory) / "metadata.json").exists():
            raise ModelUnavailable("toddler questionnaire checkpoint not found")
        _cache[key] = ToddlerModel(directory)
    return _cache[key]


def reset_cache() -> None:
    _cache.clear()
