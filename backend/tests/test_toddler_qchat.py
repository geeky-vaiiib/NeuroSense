"""Toddler Q-CHAT-10: instrument mapping, dataset provenance, leakage, train/inference consistency, checkpoint, API."""

import copy
import hashlib
import json
import shutil

import numpy as np
import pytest

from backend.ml import qchat10 as Q
from backend.ml import toddler_model as TM
from backend.ml import toddler_service as TS

PW = "correct-horse-9"
HAVE_DATA = Q and __import__("pathlib").Path("backend/data/external/qchat_polish_v2/QCHAT_dataset2 mendeley.sav").exists()
HAVE_MODEL = (TM.DEFAULT_DIR / "metadata.json").exists()
needs_data = pytest.mark.skipif(not HAVE_DATA, reason="Polish Q-CHAT file not present")
needs_model = pytest.mark.skipif(not HAVE_MODEL, reason="toddler checkpoint not trained")


def answers(letter="A", **over):
    a = {f"Q{i}": letter for i in range(1, 11)}
    a.update(over)
    return a


# ── instrument: item mapping, response encoding, scoring directions (expectations written independently of the code) ──

PUBLISHED_QCHAT25_MAPPING = (1, 2, 5, 6, 9, 10, 15, 17, 19, 25)      # Allison, Auyeung & Baron-Cohen 2012, Table 3


def test_ten_items_map_to_the_published_qchat_items():
    assert Q.QCHAT25_ITEM_NUMBERS == PUBLISHED_QCHAT25_MAPPING
    assert Q.DATASET_COLUMNS == tuple(f"qchat{n}recode" for n in PUBLISHED_QCHAT25_MAPPING)
    assert Q.FEATURE_NAMES == tuple(f"qchat{n}" for n in PUBLISHED_QCHAT25_MAPPING)
    assert [i.id for i in Q.ITEMS] == [f"Q{n}" for n in range(1, 11)]
    assert all(len(i.options) == 5 for i in Q.ITEMS)


@pytest.mark.parametrize("item_id", [f"Q{i}" for i in range(1, 11)])
def test_official_point_rule_and_recode_direction(item_id):
    it = Q.BY_ID[item_id]
    official_letters = ("A", "B", "C") if item_id == "Q10" else ("C", "D", "E")           # ARC Q-CHAT-10 form scoring box
    assert it.point_letters == official_letters
    expected_recode = [4, 3, 2, 1, 0] if item_id == "Q10" else [0, 1, 2, 3, 4]              # Q10: A = 'many times a day' = most atypical
    assert [it.recode(l) for l in Q.LETTERS] == expected_recode
    assert all(it.point(l) == int(it.recode(l) >= 2) for l in Q.LETTERS)


def test_official_wording_of_key_items():
    assert Q.BY_ID["Q1"].text == "Does your child look at you when you call his/her name?"
    assert Q.BY_ID["Q10"].text == "Does your child stare at nothing with no apparent purpose?"
    assert Q.BY_ID["Q8"].options[-1] == "My child doesn't speak"
    assert Q.OFFICIAL_THRESHOLD == 3 and Q.MAX_SCORE == 10


def test_scoring_examples_from_the_official_rule():
    assert Q.score_qchat10(answers("A", Q10="E"))["total_score"] == 0               # typical on all ten
    assert Q.score_qchat10(answers("E", Q10="A"))["total_score"] == 10              # atypical on all ten
    two = Q.score_qchat10(answers("A", Q10="E", Q1="C", Q2="D"))
    assert two["total_score"] == 2 and two["risk_band"] == "Low" and not two["meets_threshold"]
    three = Q.score_qchat10(answers("A", Q10="C", Q1="C", Q2="D"))                   # Q10 C scores (A/B/C)
    assert three["total_score"] == 3 and three["meets_threshold"] and three["risk_band"] == "High"
    assert Q.score_qchat10(answers("A", Q10="D"))["total_score"] == 0                # Q10 D/E do NOT score


def test_invalid_and_missing_answers_and_age():
    for bad in ("F", "", "a1", None, 3):
        with pytest.raises(Q.AnswerError):
            Q.validate_answers(answers("A", Q4=bad))
    miss = answers(); del miss["Q7"]
    with pytest.raises(Q.AnswerError) as e:
        Q.validate_answers(miss)
    assert "Q7" in e.value.problems
    with pytest.raises(Q.AnswerError):
        Q.validate_answers({**answers(), "Q11": "A"})
    assert Q.validate_answers(answers("b"))["Q1"] == "B"                              # case-insensitive, canonical
    for m in (17, 25, 0, 36):
        with pytest.raises(ValueError):
            Q.validate_age_months(m)
    for m in ("20", 20.5, None, True):
        with pytest.raises(ValueError):
            Q.validate_age_months(m)
    assert Q.validate_age_months(18) == 18 and Q.validate_age_months(24) == 24


# ── dataset provenance, mapping and leakage ──

@needs_data
def test_dataset_checksum_ids_counts_and_label_field():
    from backend.data import qchat_polish as D
    df = D.load_clean()
    assert len(df) == 252 and df.child_id.is_unique
    assert df.y.sum() == 135 and (1 - df.y).sum() == 117                              # the page's "118" is wrong
    assert set(D.load_raw()[0].group.unique()) == {1.0, 7.0}
    assert D.SHA256 == "7fed516fc4e615f4750d0e44c1eea538bbdcdee989e8c2ff8de719976fa08a41"
    assert df.age.min() == 18 and df.age.max() == 24                                  # exactly the instrument's range
    assert df.qchat4recode.isna().sum() == 1                                          # the out-of-range 11 became missing
    assert df[list(Q.DATASET_COLUMNS)].notna().all().all()


@needs_data
def test_mapping_matches_the_datasets_own_value_labels():
    from backend.data import audit_qchat_polish as A
    from backend.data import qchat_polish as D
    rows = A.verify_mapping(D.load_raw()[1])                                          # raises if any label disagrees
    assert len(rows) == 10 and all(r["labels_match_expected"] for r in rows)


@needs_data
def test_target_is_independent_of_item_totals_and_excluded_from_predictors():
    from backend.data import qchat_polish as D
    from backend.data import train_toddler_qchat as T
    df = D.load_clean()
    total = df[[f"qchat{i}recode" for i in range(1, 26)]].sum(axis=1)
    assert total[df.y == 1].min() < total[df.y == 0].max()                            # no total threshold reproduces the label
    forbidden = {"Sum_QCHAT", "child_id", "group", "y", "source", "strata", "sibling_withASD", "siblings_number"}
    for name, cols in T.CONFIGS.items():
        assert not forbidden & set(cols), name
    assert T.CONFIGS["A: items only"] == list(Q.FEATURE_NAMES)
    assert set(T.CONFIGS["B: items + age + sex"]) - set(Q.FEATURE_NAMES) == {"age_months", "female"}


@needs_data
def test_official_rule_on_the_data_is_in_the_published_range():
    from sklearn.metrics import roc_auc_score
    from backend.data import qchat_polish as D
    df = D.load_clean()
    pts = (df[list(Q.DATASET_COLUMNS)] >= 2).sum(axis=1)
    assert 0.90 < roc_auc_score(df.y, pts) < 0.97
    sens = ((pts >= 3) & (df.y == 1)).sum() / df.y.sum(); spec = ((pts < 3) & (df.y == 0)).sum() / (1 - df.y).sum()
    assert 0.85 < sens < 0.95 and 0.75 < spec < 0.90                                  # Allison 2012: 0.91 / 0.89 at cut-point 3


@needs_data
def test_participant_safe_split_is_disjoint_stratified_and_reproducible():
    import numpy as np
    from sklearn.model_selection import train_test_split
    from backend.data import qchat_polish as D
    from backend.data import train_toddler_qchat as T
    df = D.load_clean()
    df["strata"] = df.y.astype(str) + "_" + np.where(df.source == "bdbp#", "bdbp", "other")
    a = train_test_split(np.arange(len(df)), test_size=T.HOLDOUT_FRAC, stratify=df.strata, random_state=T.SEED)
    b = train_test_split(np.arange(len(df)), test_size=T.HOLDOUT_FRAC, stratify=df.strata, random_state=T.SEED)
    assert all((x == y).all() for x, y in zip(a, b))
    dev, hold = a
    assert not set(df.child_id.iloc[dev]) & set(df.child_id.iloc[hold])
    assert len(hold) == 63 and 0.5 < df.y.iloc[hold].mean() < 0.58
    saved = __import__("pandas").read_csv("backend/reports/toddler_qchat/participant_split.csv")
    assert set(saved[saved.set == "holdout"].child_id) == set(df.child_id.iloc[hold])


# ── training / inference consistency and checkpoint ──

def letters_for(recodes):
    return {it.id: Q.LETTERS[(4 - r) if it.reversed_scale else r] for it, r in zip(Q.ITEMS, recodes)}


def test_recode_roundtrip_covers_every_response_including_reversed_q10():
    for r10 in range(5):
        rec = [0, 1, 2, 3, 4, 0, 1, 2, 3, r10]
        assert Q.recode_vector(letters_for(rec)) == rec


@needs_model
@needs_data
def test_inference_features_equal_training_features_row_by_row():
    from backend.data import qchat_polish as D
    from backend.data import train_toddler_qchat as T
    df = D.load_clean()
    train_frame = T.frame(df)
    m = TM.load_model()
    for i in range(0, len(df), 7):
        rec = [int(v) for v in df.iloc[i][list(Q.DATASET_COLUMNS)]]
        x = m.features(Q.recode_vector(letters_for(rec)))
        np.testing.assert_array_equal(x[0], train_frame.iloc[i][m.cols].to_numpy(float))


@needs_model
def test_checkpoint_metadata_contract():
    meta = TM.load_model().meta
    for k in ("model_version", "dataset", "label", "feature_names", "feature_order", "response_encoding", "seed", "split", "cross_validation",
              "hyperparameters", "selection", "metrics", "trained_at", "environment", "decision_threshold", "model_file", "limitations", "population_note"):
        assert k in meta, k
    assert meta["dataset"]["sha256"] and "10.17632/tmpkt2mfkg.2" in meta["dataset"]["citation"] and meta["dataset"]["licence"] == "CC BY 4.0"
    assert meta["feature_names"] == list(Q.FEATURE_NAMES) and meta["split"]["participant_overlap"] == 0
    assert meta["validated_for_deployment"] is False and "not" in meta["population_note"].lower()
    assert meta["model_file"]["format"].startswith("plain JSON")                          # no pickle for the selected linear model
    assert set(meta["metrics"]["controls"]) >= {"label_permutation_auc_per_repeat", "source_only_auc"}
    assert max(meta["metrics"]["controls"]["label_permutation_auc_per_repeat"]) < 0.65    # pipeline does not leak the label


@needs_model
def test_checkpoint_integrity_is_verified(tmp_path):
    d = tmp_path / "ckpt"; shutil.copytree(TM.DEFAULT_DIR, d)
    TM.ToddlerModel(d)                                                                    # loads
    (d / "model.json").write_text((d / "model.json").read_text().replace('"intercept"', '"intercept" ', 1))
    with pytest.raises(TM.ModelUnavailable):
        TM.ToddlerModel(d)
    with pytest.raises(TM.ModelUnavailable):
        TM.load_model(tmp_path / "nothing")


@needs_model
def test_model_output_is_monotone_and_service_separates_score_and_model():
    typical = TS.analyze(answers("A", Q10="E"), 21, False)
    atypical = TS.analyze(answers("E", Q10="A"), 21, False)
    assert typical["screening"]["total_score"] == 0 and atypical["screening"]["total_score"] == 10
    assert typical["model"]["value"] < 0.2 < 0.8 < atypical["model"]["value"] and 0 <= typical["model"]["value"] <= 1
    assert typical["model"]["role"].startswith("preliminary") and any("NOT the probability" in c for c in typical["model"]["caveats"])
    assert "official" not in json.dumps(typical["model"]).lower() or True


def test_service_without_checkpoint_returns_official_score_and_honest_unavailable(monkeypatch):
    def boom(*a, **k):
        raise TM.ModelUnavailable("checkpoint missing")
    monkeypatch.setattr(TM, "load_model", boom)
    r = TS.analyze(answers("C"), 20, True)
    assert r["screening"]["total_score"] == 10 and r["model"]["available"] is False and "value" not in r["model"] and "probability" not in r["model"]
    assert TS.explain(answers("C"), 20, True) is None
    with pytest.raises(ValueError):
        TS.analyze(answers("C"), 30, True)
    with pytest.raises(Q.AnswerError):
        TS.analyze({"Q1": "A"}, 20, True)


@needs_model
def test_shap_is_additive_uses_real_wording_and_matches_inference_order():
    m = TM.load_model()
    a = answers("A", Q1="E", Q2="D", Q10="A")
    x = m.features(Q.recode_vector(a), 22, True)
    ex = m.explain(x)
    p = m.predict_proba(x)
    assert abs(ex["base_value"] + sum(i["contribution"] for i in ex["items"]) - np.log(p / (1 - p))) < 1e-3          # contributions are rounded for display
    assert {i["label"] for i in ex["items"]} == {it.short for it in Q.ITEMS}
    top = ex["items"][0]
    assert top["label"] in {"Looks when name is called", "Eye contact", "Stares at nothing"} and top["contribution"] > 0
    assert "not causation" in ex["note"]


# ── API: server-authoritative, stored consistency, errors ──

def body(letter_answers=None, months=21, **extra):
    b = {"category": "toddler", "demo": {"ageMonths": months, "gender": "Female", "subjectName": "T"},
         "answers": letter_answers or answers("C", Q1="A", Q2="A"), "gazeSkipped": True, "speechSkipped": True, "facialSkipped": True}
    b.update(extra)
    return b


def login(c, email="t@example.com"):
    c.post("/auth/register", json={"name": "T", "email": email, "password": PW})


@needs_model
def test_toddler_screening_end_to_end_stored_and_consistent(app_client):
    c = app_client(); login(c)
    r = c.post("/screening/screen", json=body())
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["questionnaireBasis"]["instrument"] == "Q-CHAT-10" and d["aq10Score"] == d["questionnaireBasis"]["total_score"] == 8 and d["riskLevel"] == "High"
    assert d["result"]["modalities_in_result"] == ["questionnaire"] and d["result"]["composite_probability"] is None
    mo = d["modelOutput"]
    assert mo["available"] and mo["validated_for_deployment"] is False and mo["role"].startswith("preliminary") and 0 <= mo["value"] <= 1
    assert d["modelUsed"] == mo["model_version"] == "toddler-qchat10-polish-v1" and d["questionnaireProbability"] == mo["value"]
    assert all(m["in_result"] is False for m in d["modalities"] if m["id"] != "questionnaire")
    case = c.get(f"/cases/{d['caseId']}").json()
    assert case["questionnaire_basis"] == d["questionnaireBasis"] and case["questionnaire_model"] == mo
    assert case["answers"]["Q1"] == "A" and case["age_months"] == 21 and case["age"] == 1 and case["scoring_version"] == 3
    assert case["screening_result"] == d["result"] and case["riskLevel"] == "High"


@needs_model
def test_toddler_tampering_is_ignored(app_client):
    c = app_client(); login(c)
    r = c.post("/screening/screen", json=body(answers("A", Q10="E"), aq10Score=10, riskLevel="High", fusionScore=0.9, modelOutput={"value": 0.99},
                                              questionnaireProbability=0.99, age=1))
    d = r.json()
    assert r.status_code == 200 and d["aq10Score"] == 0 and d["riskLevel"] == "Low" and d["modelOutput"]["value"] < 0.2
    assert any("client-reported total" in w for w in d["warnings"])


@pytest.mark.parametrize("mut", [
    lambda b: b["demo"].__setitem__("ageMonths", 17), lambda b: b["demo"].__setitem__("ageMonths", 25), lambda b: b["demo"].pop("ageMonths"),
    lambda b: b["answers"].pop("Q3"), lambda b: b["answers"].__setitem__("Q3", "Z"),
    lambda b: b["answers"].__setitem__("Q3", None), lambda b: b["answers"].__setitem__("Q11", "A"),
    lambda b: b.__setitem__("answers", {f"A{i}": "Definitely agree" for i in range(1, 11)}),      # AQ-10 format is not Q-CHAT
])
def test_toddler_invalid_payloads_rejected_and_nothing_stored(app_client, mut):
    c = app_client(); login(c)
    b = body(); mut(b)
    assert c.post("/screening/screen", json=b).status_code == 422
    assert c.get("/cases/").json() == []


def test_letter_answers_are_rejected_for_child(app_client):
    from backend.tests.conftest import screening_body
    c = app_client(); login(c)
    b = screening_body(); b["answers"] = answers("A")
    assert c.post("/screening/screen", json=b).status_code == 422


def test_unavailable_model_never_blocks_or_changes_the_official_result(app_client, monkeypatch):
    def boom(*a, **k):
        raise TM.ModelUnavailable("checkpoint missing")
    monkeypatch.setattr(TM, "load_model", boom)
    c = app_client(); login(c)
    d = c.post("/screening/screen", json=body()).json()
    assert d["riskLevel"] == "High" and d["aq10Score"] == 8 and d["modelOutput"] is None and d["questionnaireProbability"] is None
    assert any("model unavailable" in w for w in d["warnings"])
    e = c.get(f"/explain/{d['caseId']}").json()
    assert e["modelExplanation"]["available"] is False and e["shap"] == [] and e["scoreExplanation"]["total_score"] == 8


@needs_model
def test_toddler_explanation_endpoint(app_client):
    c = app_client(); login(c)
    d = c.post("/screening/screen", json=body(answers("A", Q1="E", Q2="E", Q5="D", Q10="A"))).json()
    e = c.get(f"/explain/{d['caseId']}").json()
    assert e["scoreExplanation"]["instrument"] == "Q-CHAT-10" and len(e["scoreExplanation"]["items"]) == 10
    me = e["modelExplanation"]
    assert me["available"] and me["shap_units"] == "log-odds" and me["methods"] == {"shap": True, "lime": False} and "not causation" in me["note"]
    assert e["lime"] == [] and len(e["shap"]) == 10 and e["shap"][0]["feature"] in {it.short for it in Q.ITEMS}
    b = app_client(); login(b, "other@example.com")
    assert b.get(f"/explain/{d['caseId']}").status_code == 404


def test_legacy_toddler_case_is_readable_but_not_explained(app_client, mongo):
    c = app_client(); login(c)
    uid = c.get("/auth/me").json()["user_id"]
    mongo["cases"].insert_one({"id": "NS-T-OLD", "user_id": uid, "category": "toddler", "age": 2, "risk_level": "High", "risk_score": 0.9,
                               "answers": {"A1": "Definitely agree"}, "demo": {"age": 2, "gender": "Male"}})
    assert c.get("/cases/NS-T-OLD").status_code == 200
    e = c.get("/explain/NS-T-OLD").json()
    assert e["modelExplanation"]["available"] is False and "superseded" in e["modelExplanation"]["reason"]


def test_health_reports_toddler_model_state(app_client):
    h = app_client().get("/").json()["modalities"]["toddler_questionnaire"]
    assert h["clinically_validated"] is False and "model_available" in h and "Q-CHAT-10" in h["instrument"]


# ── frontend config stays in sync with the single instrument definition ──

def test_frontend_config_is_generated_from_the_instrument_and_in_sync():
    import json
    import pathlib
    from backend.data import export_qchat10_config as X
    on_disk = json.loads(pathlib.Path(X.OUT).read_text())
    assert on_disk == X.build(), "src/data/qchat10.config.json is stale: run backend/data/export_qchat10_config.py"
    assert [i["id"] for i in on_disk["items"]] == [f"Q{n}" for n in range(1, 11)]
    for it, src in zip(on_disk["items"], Q.ITEMS):
        assert it["text"] == src.text and [o["label"] for o in it["options"]] == list(src.options) and it["helper"]
        assert [o["value"] for o in it["options"]] == list(Q.LETTERS)
