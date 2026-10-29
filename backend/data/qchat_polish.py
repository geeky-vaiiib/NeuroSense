"""Loader for the Polish Q-CHAT dataset (Mendeley Data V2) with provenance checks.  Training/audit side only."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent / "external" / "qchat_polish_v2"
SAV = ROOT / "QCHAT_dataset2 mendeley.sav"
SHA256 = "7fed516fc4e615f4750d0e44c1eea538bbdcdee989e8c2ff8de719976fa08a41"      # published by Mendeley for this file
CITATION = ("Niedźwiecka, A., Pisula, E., Domasiewicz, Z. (2020). Q-CHAT scores of Polish toddlers with autism spectrum disorders "
            "and typically developing controls. Mendeley Data, V2. doi:10.17632/tmpkt2mfkg.2 (CC BY 4.0)")
GROUP_CODES = {1: "ASD", 7: "control"}                 # SPSS value labels of `group`
POSITIVE_CLASS = "ASD"


def load_raw() -> tuple[pd.DataFrame, object]:
    import pyreadstat
    got = hashlib.sha256(SAV.read_bytes()).hexdigest()
    if got != SHA256:
        raise ValueError(f"dataset checksum mismatch: {got} != {SHA256}")
    return pyreadstat.read_sav(str(SAV))


def source_of(child_id) -> str:
    """Recruitment-source proxy from the id prefix (FS/, bdbp, A<n>, plain number). Used ONLY to stratify and audit - never a predictor."""
    s = str(child_id)
    return re.sub(r"\d+", "#", s)


def load_clean() -> pd.DataFrame:
    """One row per child: child_id, y (1 = ASD, 0 = control), source, age, sex, the 25 item columns (invalid values -> NaN) and demographics."""
    df, _ = load_raw()
    if not set(df.group.unique()) <= set(GROUP_CODES):
        raise ValueError(f"unexpected group codes {df.group.unique()}")
    out = df.copy()
    out["y"] = (out.group == 1).astype(int)
    out["source"] = out.child_id.map(source_of)
    items = [f"qchat{i}recode" for i in range(1, 26)]
    out[items] = out[items].where((out[items] >= 0) & (out[items] <= 4))           # e.g. qchat4recode = 11 -> NaN (flagged in the audit)
    if out.child_id.duplicated().any():
        raise ValueError("duplicate participant ids")
    return out
