"""Dataset audit for the Polish Q-CHAT data (run BEFORE any training).

    python -m backend.data.audit_qchat_polish

Writes backend/reports/toddler_qchat/dataset_audit.{json,md}.  Raises if the dataset's own value labels do not match the
Q-CHAT-10 item mapping in ml/qchat10.py (the mapping is taken from the published form and paper, then CHECKED here).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import qchat_polish as D  # noqa: E402
from backend.ml import qchat10 as Q  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "reports" / "toddler_qchat"


def verify_mapping(meta) -> list[dict]:
    """Compare the dataset's value labels for each of the ten mapped items with the expected Polish option labels."""
    rows = []
    for it in Q.ITEMS:
        got = {int(k): v for k, v in meta.variable_value_labels[it.dataset_column].items()}
        exp = dict(it.pl_value_labels)
        note = None
        if it.id == "Q2":      # dataset attaches the label 'niemożliwe' (impossible) to value 5; value 5 never occurs, 4 is the scale maximum
            got = {(4 if k == 5 else k): v for k, v in got.items()}
            note = "label 'niemożliwe' (impossible) is attached to value 5 in the file; 5 never occurs; read as 4 (scale maximum)"
        ok = got == exp
        rows.append({"item": it.id, "qchat25_item": it.qchat25, "column": it.dataset_column, "labels_match_expected": ok, "dataset_labels": got, "note": note})
        if not ok:
            raise AssertionError(f"{it.dataset_column}: dataset labels {got} differ from expected {exp}")
    return rows


def main() -> dict:
    from sklearn.metrics import roc_auc_score
    df, meta = D.load_raw()
    clean = D.load_clean()
    y = clean.y.to_numpy()
    items25 = [f"qchat{i}recode" for i in range(1, 26)]
    ten = list(Q.DATASET_COLUMNS)
    a: dict = {"dataset": D.CITATION, "file": D.SAV.name, "sha256_verified": True, "licence": "CC BY 4.0 (attribution required; indicate changes)"}
    a["rows"] = int(len(df)); a["unique_child_id"] = int(df.child_id.nunique()); a["duplicate_ids"] = df.child_id[df.child_id.duplicated(keep=False)].tolist()
    g = df.group.map(D.GROUP_CODES).value_counts().to_dict()
    a["class_counts"] = {k: int(v) for k, v in g.items()}
    a["count_discrepancy"] = {"dataset_page_says": "252 toddlers; 135 ASD and 118 TD (135 + 118 = 253)", "file_has": a["class_counts"], "rows": a["rows"],
                              "resolution": "the file has 252 rows = 135 ASD + 117 controls; the '118' on the page is inconsistent with its own total of 252"}
    a["duplicate_item_patterns"] = int(clean.duplicated(items25, keep=False).sum())
    a["item_columns"] = items25
    a["response_scale"] = "integers 0-4 per item, higher = more atypical (already direction-recoded by the authors; `*recode` columns)"
    a["out_of_range_items"] = {c: df.loc[(df[c] > 4) | (df[c] < 0), ["child_id", "group", c]].to_dict("records") for c in items25 if ((df[c] > 4) | (df[c] < 0)).any()}
    a["out_of_range_handling"] = "values outside 0-4 are set to missing; none of the ten mapped items is affected"
    a["missing_values"] = {c: int(v) for c, v in df.isna().sum().items() if v}
    a["ten_items_missing"] = int(clean[ten].isna().sum().sum())
    a["sum_qchat_equals_item_sum"] = bool(((df[items25].sum(axis=1) - df.Sum_QCHAT).abs() < 1e-9).all())
    a["demographic_variables"] = ["age (months)", "sex", "preterm", "birthweight", "siblings_yesno", "siblings_number", "mothers_education", "sibling_withASD"]
    a["age_months"] = {k: {s: float(v) for s, v in clean[clean.y == (1 if k == "ASD" else 0)].age.describe()[["mean", "std", "min", "max"]].items()} for k in ("ASD", "control")}
    a["age_values"] = {int(k): int(v) for k, v in clean.age.value_counts().sort_index().items()}
    a["sex_by_group"] = {k: {int(s): int(n) for s, n in clean[clean.y == v].sex.value_counts().items()} for k, v in (("ASD", 1), ("control", 0))}
    a["sibling_withASD_by_group"] = {k: {str(s): int(n) for s, n in clean[clean.y == v].sibling_withASD.value_counts(dropna=False).items()} for k, v in (("ASD", 1), ("control", 0))}
    # item mapping
    a["mapping_verification"] = verify_mapping(meta)
    a["mapping_source"] = "Allison, Auyeung & Baron-Cohen 2012 JAACAP 51(2):202-212, Table 3 (Q-CHAT-10 = Q-CHAT items 1,2,5,6,9,10,15,17,19,25); wording/scoring: ARC Q-CHAT-10 form"
    # leakage / confound checks
    a["label_provenance"] = {
        "field": "group (1 = ASD, 7 = control)",
        "dataset_page_statement": "'135 with a community-based diagnosis of autism spectrum disorders (ASD) and ... typically developing toddlers'",
        "documented_instruments": "NOT stated on the dataset page. The related Polish Q-CHAT paper (Niedźwiecka & Pisula 2022, PMC8910243) studies a different 1,024-child sample whose 252 'ASD-concerns' children had no confirmed diagnosis and does not mention ADOS-2/ADI-R/DSM-5 for it; the dataset's own manuscript was 'under review' and could not be located.",
        "assessment": "Label is independent of the Q-CHAT (not derived from item totals) but its clinical rigor (ADOS-2/ADI-R/DSM-5) is NOT verified from the sources available here.",
        "control_definition": "typically developing; recruitment channel/screening of controls not documented"}
    a["target_not_derived_from_items"] = {"auc_of_item_sum_25": float(roc_auc_score(y, clean[items25].sum(axis=1))),
                                         "separable_by_a_total_threshold": bool(clean[items25].sum(axis=1)[y == 1].min() > clean[items25].sum(axis=1)[y == 0].max())}
    b = (clean[ten] >= 2).sum(axis=1)
    a["official_qchat10_rule_on_this_data"] = {f">={t}": {"sensitivity": float(((b >= t) & (y == 1)).sum() / y.sum()), "specificity": float(((b < t) & (y == 0)).sum() / (1 - y).sum())} for t in (2, 3, 4, 5)}
    a["official_qchat10_auc"] = float(roc_auc_score(y, b))
    a["publication_check"] = "Allison 2012 reports sensitivity 0.91 / specificity 0.89 at cut-point 3 (different samples)"
    src = pd.crosstab(clean.source, clean.y).rename(columns={0: "control", 1: "ASD"})
    a["recruitment_source_by_group"] = {k: {c: int(v) for c, v in row.items()} for k, row in src.iterrows()}
    a["source_confound_auc_if_only_source_known"] = float(roc_auc_score(y, clean.source.map(clean.groupby("source").y.mean())))
    a["single_variable_aucs"] = {"age": float(roc_auc_score(y, clean.age)), "female": float(roc_auc_score(y, clean.sex == 2)), "birthweight(non-missing)": float(roc_auc_score(y[clean.birthweight.notna()], clean.birthweight.dropna()))}
    a["sampling_limitations"] = [
        "case-control design: 53.6% ASD; prevalence in the intended population is far lower, so predicted probabilities are not population risk and PPV would be much lower",
        "recruitment source almost determines the label (bdbp# ids: 89 controls vs 2 ASD; FS/# ids: 80 ASD vs 12 controls): collection context is confounded with diagnosis",
        "Polish translation of the Q-CHAT, completed by caregivers in Poland; not validated for English-language or other populations",
        "ages 18-24 months only; sex imbalance (ASD 71% male, controls 52% male)",
        "ASD labels described as 'community-based diagnosis'; instruments used are not documented on the dataset page",
        "sibling_withASD is missing/0 for every control (structural), so it must never be a predictor"]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dataset_audit.json").write_text(json.dumps(a, indent=1, default=str, ensure_ascii=False))
    md = ["# Polish Q-CHAT dataset audit (Mendeley Data V2)", "", f"Citation: {D.CITATION}", "",
          f"- File `{D.SAV.name}` sha256 verified. **Rows {a['rows']}** = ASD {a['class_counts']['ASD']} + control {a['class_counts']['control']}; unique child ids {a['unique_child_id']}; duplicate ids {len(a['duplicate_ids'])}; duplicate 25-item patterns {a['duplicate_item_patterns']}.",
          f"- Count discrepancy: {a['count_discrepancy']['dataset_page_says']} → {a['count_discrepancy']['resolution']}.",
          f"- Response scale: {a['response_scale']}. Out-of-range: {a['out_of_range_items']} (set to missing; none of the ten mapped items affected). Missing in the ten items: {a['ten_items_missing']}.",
          f"- Age: {a['age_values']} months (instrument range 18-24). Sex by group: {a['sex_by_group']}.",
          f"- Mapping verified against the dataset's Polish value labels for all ten items (Q2 label typo noted).",
          f"- Official Q-CHAT-10 rule on this data: " + "; ".join(f"{k}: sens {v['sensitivity']:.2f} / spec {v['specificity']:.2f}" for k, v in a['official_qchat10_rule_on_this_data'].items()) + f"; AUC {a['official_qchat10_auc']:.3f}.",
          f"- Label provenance: {a['label_provenance']['dataset_page_statement']}. {a['label_provenance']['assessment']}",
          f"- Recruitment source × group: {a['recruitment_source_by_group']} (source alone would give AUC {a['source_confound_auc_if_only_source_known']:.2f}).",
          "", "## Sampling limitations", *[f"- {s}" for s in a["sampling_limitations"]],
          "", "## Licence", "CC BY 4.0: attribution required (see citation); changes must be indicated (item values outside 0-4 set to missing; ten of 25 items used)."]
    (OUT / "dataset_audit.md").write_text("\n".join(md))
    print("\n".join(md))
    return a


if __name__ == "__main__":
    main()
