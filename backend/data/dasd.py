"""DASD dataset discovery, label mapping and participant-level splits (training side only).

Labels: DASD's README states 82 children (ASD: 57; TD: 25), diagnosed with ADOS-2.  The folders
are `abnormal/` (57 files) and `normal/` (25 files) and `code/class_indices.json` maps
0->abnormal, 1->normal.  The counts match the README exactly, so abnormal=ASD, normal=TD.
FILE NAMES ARE NOT LABELS: every file is called `normal_<n>.csv`, including those in `abnormal/`.
Participant = one CSV (the README gives one recording per child); the id includes the class
folder because file numbers repeat across the two folders.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DASD_ROOT = ROOT / "DASD-main"
FOLDER_TO_LABEL = {"abnormal": 1, "normal": 0}          # ASD = 1, TD = 0
LABEL_NAMES = {1: "ASD", 0: "TD"}
README_COUNTS = {"ASD": 57, "TD": 25}


@dataclass(frozen=True)
class Recording:
    participant_id: str
    path: Path
    label: int
    official_split: str            # "train" | "test" as shipped by the dataset authors


def discover(root: Path = DASD_ROOT) -> list[Recording]:
    recs = []
    for split in ("train", "test"):
        for folder, label in FOLDER_TO_LABEL.items():
            for p in sorted((root / "dataset" / split / folder).glob("*.csv")):
                recs.append(Recording(f"{folder}/{p.stem}", p, label, split))
    ids = [r.participant_id for r in recs]
    if len(ids) != len(set(ids)):
        raise ValueError("participant ids are not unique (same child may be in train and test)")
    return recs


def validate_labels(recs: list[Recording]) -> dict:
    n_asd = sum(r.label == 1 for r in recs); n_td = sum(r.label == 0 for r in recs)
    if (n_asd, n_td) != (README_COUNTS["ASD"], README_COUNTS["TD"]):
        raise ValueError(f"label counts {n_asd}/{n_td} disagree with the DASD README {README_COUNTS}")
    return {"ASD": n_asd, "TD": n_td}


def read_csv(rec: Recording) -> pd.DataFrame:
    return pd.read_csv(rec.path)


def official_split(recs: list[Recording]) -> tuple[list[Recording], list[Recording]]:
    return ([r for r in recs if r.official_split == "train"],
            [r for r in recs if r.official_split == "test"])


def assert_disjoint(*groups: list[Recording]) -> None:
    seen: set[str] = set()
    for g in groups:
        ids = {r.participant_id for r in g}
        if ids & seen:
            raise AssertionError(f"participants leak across splits: {sorted(ids & seen)[:5]}")
        seen |= ids


def stratified_participant_folds(recs: list[Recording], n_splits: int, seed: int):
    """Yield (train_recs, test_recs); every participant appears in exactly one test fold."""
    from sklearn.model_selection import StratifiedKFold
    y = [r.label for r in recs]
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    for tr, te in skf.split(recs, y):
        a, b = [recs[i] for i in tr], [recs[i] for i in te]
        assert_disjoint(a, b)
        yield a, b


def holdout_split(recs: list[Recording], frac: float, seed: int):
    from sklearn.model_selection import train_test_split
    a, b = train_test_split(recs, test_size=frac, stratify=[r.label for r in recs], random_state=seed)
    assert_disjoint(a, b)
    return a, b
