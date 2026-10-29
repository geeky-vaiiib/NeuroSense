"""Train an ASD vs typical speech classifier from a PARTICIPANT-LABELLED corpus (reproducible, leakage-safe).

    python -m backend.data.train_speech_asd --manifest my_corpus.csv --dataset-name "<name>" --license "<terms>" \
           [--out backend/models/speech_asd_model.json]

No suitable corpus ships with NeuroSense, so this script does nothing by default and the app reports speech
classification as unavailable.  What it will and will not do:

  * Manifest CSV columns: participant_id, label (ASD | TD), path (audio file).  Labels must be the dataset's
    clinical labels; the script refuses to guess labels from file names and does not accept emotion corpora relabelled
    as ASD.  A participant must have one label across all of its recordings.
  * Split BY PARTICIPANT (stratified): train / validation / test.  Recordings of one participant never cross splits.
  * Hyper-parameters (C) and the decision threshold are chosen on the validation split ONLY; the test split is
    evaluated exactly once at the end and never used to change anything.
  * Metrics at participant level (mean of recording probabilities): accuracy, precision, recall(sensitivity),
    specificity, F1, ROC-AUC, confusion matrix.
  * Output is a JSON checkpoint (coefficients + scaler + metadata): no pickle, nothing executable to deserialise.
  * Feature extraction/ordering are the shared ones in ml/speech_features.py (identical at inference).
  * The checkpoint is written with validated_for_deployment=False: a model that merely trains is not validated, and
    the fusion contract excludes speech regardless until a deployment-population validation is documented.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.ml import speech_features as SF  # noqa: E402

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
REPORTS = Path(__file__).resolve().parents[1] / "reports"
MIN_PARTICIPANTS_PER_CLASS = 20
SEED = 42


class ManifestError(ValueError):
    pass


def validate_manifest(df: pd.DataFrame) -> pd.DataFrame:
    need = {"participant_id", "label", "path"}
    if not need <= set(df.columns):
        raise ManifestError(f"manifest needs columns {sorted(need)}; has {sorted(df.columns)}")
    df = df.copy()
    df["label"] = df["label"].astype(str).str.strip().str.upper()
    bad = sorted(set(df["label"]) - {"ASD", "TD"})
    if bad:
        raise ManifestError(f"labels must be ASD or TD, found {bad}")
    per = df.groupby("participant_id")["label"].nunique()
    if (per > 1).any():
        raise ManifestError(f"participants with conflicting labels: {list(per[per > 1].index)[:5]}")
    counts = df.drop_duplicates("participant_id")["label"].value_counts()
    for lab in ("ASD", "TD"):
        if counts.get(lab, 0) < MIN_PARTICIPANTS_PER_CLASS:
            raise ManifestError(f"need >= {MIN_PARTICIPANTS_PER_CLASS} {lab} participants for a meaningful split; have {counts.get(lab, 0)}")
    return df


def participant_split(df: pd.DataFrame, seed: int = SEED, fractions=(0.6, 0.2, 0.2)) -> dict[str, list[str]]:
    """Stratified participant-level split -> {'train': [...], 'val': [...], 'test': [...]}; disjoint by construction."""
    rng = np.random.default_rng(seed)
    out = {"train": [], "val": [], "test": []}
    people = df.drop_duplicates("participant_id")[["participant_id", "label"]]
    for lab in ("ASD", "TD"):
        ids = np.array(sorted(people[people.label == lab].participant_id)); rng.shuffle(ids)
        n = len(ids); a = int(round(n * fractions[0])); b = a + int(round(n * fractions[1]))
        out["train"] += ids[:a].tolist(); out["val"] += ids[a:b].tolist(); out["test"] += ids[b:].tolist()
    assert not (set(out["train"]) & set(out["val"]) or set(out["train"]) & set(out["test"]) or set(out["val"]) & set(out["test"]))
    return out


def participant_metrics(y_true: np.ndarray, p: np.ndarray, thr: float) -> dict:
    from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    return {"n": int(len(y_true)), "accuracy": float(accuracy_score(y_true, pred)), "precision": float(precision_score(y_true, pred, zero_division=0)),
            "recall_sensitivity": float(recall_score(y_true, pred, zero_division=0)), "specificity": float(tn / (tn + fp)) if tn + fp else None,
            "f1": float(f1_score(y_true, pred, zero_division=0)), "roc_auc": float(roc_auc_score(y_true, p)) if len(set(y_true)) == 2 else None,
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}, "threshold": float(thr)}


def _aggregate(frame: pd.DataFrame, probs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    d = frame[["participant_id", "y"]].copy(); d["p"] = probs
    g = d.groupby("participant_id").agg(y=("y", "first"), p=("p", "mean"))
    return g["y"].to_numpy(), g["p"].to_numpy()


def train_from_features(frame: pd.DataFrame, split: dict, dataset: dict, seed: int = SEED) -> tuple[dict, dict]:
    """frame: one row per recording with participant_id, y (1=ASD), and the SF.VECTOR_NAMES columns."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    cols = list(SF.VECTOR_NAMES)
    tr, va, te = (frame[frame.participant_id.isin(split[k])] for k in ("train", "val", "test"))
    sc = StandardScaler().fit(tr[cols].to_numpy())
    Xtr, Xva = sc.transform(tr[cols].to_numpy()), sc.transform(va[cols].to_numpy())
    best = None
    for C in (0.01, 0.1, 1.0, 10.0):                                    # selection on VALIDATION participants only
        m = LogisticRegression(C=C, class_weight="balanced", max_iter=5000, random_state=seed).fit(Xtr, tr.y)
        y_v, p_v = _aggregate(va, m.predict_proba(Xva)[:, 1])
        from sklearn.metrics import roc_auc_score
        auc = roc_auc_score(y_v, p_v)
        if best is None or auc > best[0]:
            best = (auc, C, m, y_v, p_v)
    _, C, m, y_v, p_v = best
    grid = np.unique(np.round(p_v, 4)); thr, bj = 0.5, -1.0                # Youden's J on validation
    for t in np.r_[0.5, grid]:
        mt = participant_metrics(y_v, p_v, t)
        j = mt["recall_sensitivity"] + (mt["specificity"] or 0) - 1
        if j > bj:
            bj, thr = j, float(t)
    val_metrics = participant_metrics(y_v, p_v, thr)
    y_t, p_t = _aggregate(te, m.predict_proba(sc.transform(te[cols].to_numpy()))[:, 1])      # test: evaluated ONCE
    test_metrics = participant_metrics(y_t, p_t, thr)
    meta = {"model_version": "speech-asd-lr-v1", "dataset": dataset, "feature_names": list(SF.VECTOR_NAMES), "preprocessing": {
                "sample_rate": SF.SAMPLE_RATE, "min_duration_s": SF.MIN_DURATION_S, "max_duration_s": SF.MAX_DURATION_S, "n_mfcc": SF.N_MFCC},
            "algorithm": f"LogisticRegression(C={C}, class_weight=balanced) on standardised features",
            "participant_level_split": True, "split_sizes": {k: len(v) for k, v in split.items()}, "seed": seed,
            "selection": "C by validation participant AUC; threshold by validation Youden J", "decision_threshold": thr,
            "metrics": {"validation": val_metrics, "test": test_metrics}, "is_synthetic_proxy": False,
            "validated_for_deployment": False, "trained_at": datetime.now(timezone.utc).isoformat(),
            "limitations": ["trained on one corpus; not validated on the NeuroSense recording setup or population"]}
    ckpt = {"coef": m.coef_[0].tolist(), "intercept": float(m.intercept_[0]), "mean": sc.mean_.tolist(), "scale": sc.scale_.tolist(), "metadata": meta}
    return ckpt, meta


def extract_table(df: pd.DataFrame) -> pd.DataFrame:
    import librosa
    rows = []
    for r in df.itertuples():
        y, sr = librosa.load(r.path, sr=SF.SAMPLE_RATE, mono=True, duration=SF.MAX_DURATION_S)
        if len(y) / sr < SF.MIN_DURATION_S:
            continue
        v = SF.feature_vector(SF.extract_features(y, sr))
        rows.append({"participant_id": r.participant_id, "y": int(r.label == "ASD"), **dict(zip(SF.VECTOR_NAMES, v))})
    return pd.DataFrame(rows)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True, type=Path)
    ap.add_argument("--dataset-name", required=True); ap.add_argument("--license", required=True)
    ap.add_argument("--out", type=Path, default=MODELS_DIR / "speech_asd_model.json")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    if a.out.exists() and not a.force:
        sys.exit(f"{a.out} exists; refusing to overwrite (use --force)")
    df = validate_manifest(pd.read_csv(a.manifest))
    missing = [p for p in df.path if not Path(p).exists()]
    if missing:
        sys.exit(f"{len(missing)} audio files missing, e.g. {missing[:3]}")
    split = participant_split(df)
    frame = extract_table(df)
    ckpt, meta = train_from_features(frame, split, {"name": a.dataset_name, "license": a.license, "manifest": str(a.manifest)})
    a.out.write_text(json.dumps(ckpt, indent=1))
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "speech_training_report.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["metrics"], indent=1))
    print(f"saved {a.out} (validated_for_deployment=False)")


if __name__ == "__main__":
    main()
