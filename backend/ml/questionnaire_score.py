"""Server-authoritative questionnaire scoring (the single implementation).

What the questionnaire result is
--------------------------------
The result is a *threshold-based screening score*: ten items are scored 0/1 and summed.  The three public
datasets used to train the ML models carry class labels that are a deterministic function of that total
(audit: backend/data/audit_questionnaire_labels.py; a threshold on the item total reproduces the label for
100% of rows in every dataset).  The ML models therefore learn the scoring rule; their output is a model
of that rule, NOT an independently validated clinical probability, and it never drives the result.

Scoring (per item, agree = "Definitely agree" | "Slightly agree"):
  * child AQ-10 (caregiver form, ages 4-11; the wording shown in the app): 1 point for AGREE on A1, A5, A7, A10;
    1 point for DISAGREE on A2, A3, A4, A6, A8, A9.
  * adult AQ-10 (self report, 18+): 1 point for AGREE on A1, A7, A8, A10; DISAGREE on A2-A6, A9.
  * toddler: the OFFICIAL Q-CHAT-10 (five lettered options per item, own scoring rule and threshold 3) lives in
    ml/qchat10.py; `score_questionnaire("toddler", ...)` delegates to it.  The agree/disagree encoding below for "toddler"
    belongs to the superseded Thabtah-dataset pipeline and is kept only so historical cases stay readable.

LABEL_RULE_THRESHOLD is the empirical rule in the data (label = total >= threshold).  It follows the dataset
providers' labelling; instrument manuals may quote a different cut-off, so treat it as "the rule the data
uses", not as a clinical cut-off.  A unit test keeps these constants true against the shipped CSVs.
"""

from __future__ import annotations

try:
    from ..core.categories import CATEGORY_SETTINGS
except ImportError:  # pragma: no cover - backend/ as cwd
    from core.categories import CATEGORY_SETTINGS

SCORING_VERSION = 2
ITEM_IDS = tuple(f"A{i}" for i in range(1, 11))
ANSWER_OPTIONS = ("Definitely agree", "Slightly agree", "Slightly disagree", "Definitely disagree")
_AGREE = {"definitely agree": 1, "slightly agree": 1, "definitely disagree": 0, "slightly disagree": 0}

TRAIT_AGREE_IDS = {                    # items where AGREE earns the point (all other items: DISAGREE earns it)
    "child": frozenset({"A1", "A5", "A7", "A10"}),
    "adult": frozenset({"A1", "A7", "A8", "A10"}),
    "toddler": frozenset({"A10"}),
}
LABEL_RULE_THRESHOLD = {"adult": 7, "child": 7, "toddler": 4}      # class = 1  <=>  total >= threshold
INSTRUMENT = {"adult": "AQ-10 (adult)", "child": "AQ-10 (child, caregiver-completed)", "toddler": "Q-CHAT-10"}
SUPPORTED_FOR_NEW_SCREENINGS = ("child", "adult", "toddler")

NOTICE = ("This is a threshold-based screening score. The machine-learning model shown beside it was trained on "
          "labels that are themselves a threshold on this score, so it reproduces the scoring rule; it is not an "
          "independently validated probability and does not change the result. A screening score is not a diagnosis.")
THRESHOLD_SOURCE = "rule used to label the training datasets (total >= threshold); verify against the instrument manual"


class AnswerError(ValueError):
    """Missing or invalid questionnaire answers (carries the offending item ids)."""

    def __init__(self, problems: dict[str, str]):
        self.problems = problems
        super().__init__("; ".join(f"{k}: {v}" for k, v in problems.items()))


def normalise_answer(value) -> str:
    """-> canonical option text; raises ValueError for anything that is not one of the four options."""
    if not isinstance(value, str):
        raise ValueError("answer must be text")
    key = value.strip().lower()
    if key not in _AGREE:
        raise ValueError("not one of: " + ", ".join(ANSWER_OPTIONS))
    return key.capitalize()


def score_items(category: str, answers: dict) -> list[int]:
    """Strict item scoring: every A1..A10 must be present and valid (no silent defaults)."""
    if category not in TRAIT_AGREE_IDS:
        raise ValueError(f"unknown category {category!r}")
    problems = {}
    points = []
    trait = TRAIT_AGREE_IDS[category]
    for item in ITEM_IDS:
        if item not in (answers or {}) or answers[item] is None:
            problems[item] = "missing"
            continue
        try:
            agree = _AGREE[normalise_answer(answers[item]).lower()]
        except ValueError as exc:
            problems[item] = str(exc)
            continue
        points.append(agree if item in trait else 1 - agree)
    if problems:
        raise AnswerError(problems)
    return points


def risk_band(category: str, total: int) -> str:
    """Presentation band of the score (NOT a probability): >= threshold High, one point below Moderate, else Low."""
    thr = LABEL_RULE_THRESHOLD[category]
    return "High" if total >= thr else "Moderate" if total == thr - 1 else "Low"


def score_questionnaire(category: str, answers: dict) -> dict:
    """The canonical, server-computed questionnaire result used by the response, the stored case and the UI."""
    if category == "toddler":
        try:
            from . import qchat10
        except ImportError:  # pragma: no cover
            from ml import qchat10
        return qchat10.score_qchat10(answers)
    pts = score_items(category, answers)
    trait = TRAIT_AGREE_IDS[category]
    total = int(sum(pts))
    thr = LABEL_RULE_THRESHOLD[category]
    items = [{"id": i, "answer": normalise_answer(answers[i]), "scores_on": "agree" if i in trait else "disagree", "points": p}
             for i, p in zip(ITEM_IDS, pts)]
    return {
        "scoring_version": SCORING_VERSION, "category": category, "instrument": INSTRUMENT[category],
        "total_score": total, "max_score": 10, "threshold": thr, "threshold_source": THRESHOLD_SOURCE,
        "meets_threshold": total >= thr, "risk_band": risk_band(category, total), "items": items,
        "validated_against_clinical_labels": False, "notice": NOTICE,
    }


def validate_age(category: str, age: int) -> None:
    """Age must lie in the instrument's range (child 4-11, adult 18+); raises ValueError."""
    if category == "toddler":
        raise ValueError("toddler age is validated in months by ml/qchat10.validate_age_months")
    s = CATEGORY_SETTINGS[category]
    if s["age_min"] is not None and age < s["age_min"]:
        raise ValueError(f"{s['label']} screening requires age >= {s['age_min']}, got {age}.")
    if s["age_max"] is not None and age > s["age_max"]:
        raise ValueError(f"{s['label']} screening requires age <= {s['age_max']}, got {age}.")


# Backwards-compatible name used by earlier code/tests.
def score_basis(category: str, answers: dict) -> dict:
    return score_questionnaire(category, answers)
