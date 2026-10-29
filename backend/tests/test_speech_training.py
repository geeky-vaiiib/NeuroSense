"""The speech training pipeline: manifest validation, participant-level split, validation-only selection, safe checkpoint."""

import json

import numpy as np
import pandas as pd
import pytest

from backend.data import train_speech_asd as T
from backend.ml import speech_engine as SE
from backend.ml import speech_features as SF


def _manifest(n_per=25, recs=3):
    rows = []
    for lab in ("ASD", "TD"):
        for i in range(n_per):
            for r in range(recs):
                rows.append({"participant_id": f"{lab}{i}", "label": lab, "path": f"{lab}{i}_{r}.wav"})
    return pd.DataFrame(rows)


def test_manifest_validation():
    assert len(T.validate_manifest(_manifest())) == 150
    with pytest.raises(T.ManifestError):
        T.validate_manifest(_manifest().drop(columns="path"))
    bad = _manifest(); bad.loc[0, "label"] = "HAPPY"
    with pytest.raises(T.ManifestError):
        T.validate_manifest(bad)
    conflict = _manifest(); conflict.loc[1, "label"] = "TD"
    with pytest.raises(T.ManifestError):
        T.validate_manifest(conflict)
    with pytest.raises(T.ManifestError):
        T.validate_manifest(_manifest(n_per=5))                # too few participants for a meaningful split


def test_split_is_by_participant_stratified_and_disjoint():
    m = T.validate_manifest(_manifest())
    sp = T.participant_split(m)
    allp = sp["train"] + sp["val"] + sp["test"]
    assert len(allp) == len(set(allp)) == 50
    for k in ("train", "val", "test"):
        labs = {p[:2] if p.startswith("TD") else "ASD" for p in sp[k]}
        assert labs == {"ASD", "TD"}                               # both classes in every split
    # every recording of a participant stays in one split
    by_split = {p: k for k, ps in sp.items() for p in ps}
    assert all(len({by_split[p] for p in g.participant_id}) == 1 for _, g in m.groupby("participant_id"))
    assert sp == T.participant_split(m)                           # reproducible


def test_training_selects_on_validation_and_writes_a_safe_loadable_checkpoint(tmp_path):
    rng = np.random.default_rng(0)
    m = T.validate_manifest(_manifest())
    sp = T.participant_split(m)
    rows = []
    for r in m.itertuples():                                       # synthetic FEATURES for a code test only (not a model claim)
        y = int(r.label == "ASD")
        v = rng.normal(0, 1, len(SF.VECTOR_NAMES)); v[0] += 1.5 * y
        rows.append({"participant_id": r.participant_id, "y": y, **dict(zip(SF.VECTOR_NAMES, v))})
    ckpt, meta = T.train_from_features(pd.DataFrame(rows), sp, {"name": "unit-test", "license": "n/a"})
    assert meta["participant_level_split"] is True and meta["validated_for_deployment"] is False and meta["is_synthetic_proxy"] is False
    for k in ("accuracy", "precision", "recall_sensitivity", "specificity", "f1", "roc_auc", "confusion_matrix"):
        assert k in meta["metrics"]["test"] and k in meta["metrics"]["validation"]
    assert meta["split_sizes"] == {k: len(v) for k, v in sp.items()}
    p = tmp_path / "m.json"; p.write_text(json.dumps(ckpt))
    clf, why = SE.load_classifier(p)
    assert clf is not None, why
    assert "pickle" not in json.dumps(ckpt).lower()


def test_cli_refuses_to_overwrite_and_never_runs_without_a_manifest(tmp_path):
    out = tmp_path / "m.json"; out.write_text("{}")
    mf = tmp_path / "m.csv"; _manifest().to_csv(mf, index=False)
    with pytest.raises(SystemExit):
        T.main(["--manifest", str(mf), "--dataset-name", "x", "--license", "y", "--out", str(out)])
    with pytest.raises(SystemExit):
        T.main([])
