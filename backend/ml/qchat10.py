"""The Q-CHAT-10 instrument: items, response options, scoring directions and the mapping to the Polish Q-CHAT dataset.

Source of truth (not inferred from wording similarity or column position):
  * Item wording, the five response options (A-E) and the OFFICIAL scoring rule:
      Autism Research Centre, "Q-CHAT-10 Quantitative Checklist for Autism in Toddlers" form (© SBC/CA/BA/ARC/Cambridge University
      1/5/12) - https://docs.autismresearchcentre.com/tests/Q-CHAT-10.pdf
      "For questions 1-9: if you circle an answer in columns C, D or E, score 1 point per question. For question 10: if you circle
       an answer in columns A, B or C, score 1 point. ... If your child scores 3 or above, the health professional may consider
       referring your child for a multi-disciplinary assessment."
  * Mapping of the ten items onto the 25-item Q-CHAT:
      Allison, Auyeung & Baron-Cohen (2012), J Am Acad Child Adolesc Psychiatry 51(2):202-212, Table 3 -> Q-CHAT items
      1, 2, 5, 6, 9, 10, 15, 17, 19, 25.  Full Q-CHAT: Allison et al. (2008), J Autism Dev Disord 38:1414-1425
      (English item/option text: https://docs.autismresearchcentre.com/tests/QCHAT.pdf).
  * Dataset: Niedźwiecka, Pisula, Domasiewicz, "Q-CHAT scores of Polish toddlers with autism spectrum disorders and typically
      developing controls", Mendeley Data, V2, doi:10.17632/tmpkt2mfkg.2 (CC BY 4.0).  Its `qchat{n}recode` columns are the item
      scores 0-4 where HIGHER = MORE ATYPICAL (verified against the dataset's own Polish value labels by
      backend/data/audit_qchat_polish.py).

Response encoding
  A client answer is one option LETTER per item (A-E, as printed on the official form).  The server derives
    recode (0-4, higher = more atypical) - the value the dataset stores and the model is trained on
    point  (0/1)                        - the official Q-CHAT-10 point
  For items Q1-Q9 the letter order equals the recode order (A=0 ... E=4).  For Q10 ("stare at nothing") the option order is
  reversed relative to atypicality (A="many times a day" is the MOST atypical), so recode = 4 - index; the official point rule
  (A, B or C) therefore equals recode >= 2 here too.  For every item: point = (recode >= 2).

The instrument is intended for children aged 18-24 months; the Polish data span exactly 18-24 months.
Copyright / licence note: the Q-CHAT is © Autism Research Centre (Cambridge); the ARC licenses its instruments for research and
non-commercial use and does not permit adaptation without permission.  Using this wording in NeuroSense must be cleared with the ARC.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

INSTRUMENT_NAME = "Q-CHAT-10"
AGE_MONTHS_MIN, AGE_MONTHS_MAX = 18, 24
OFFICIAL_THRESHOLD = 3          # "3 or above": consider referral (ARC Q-CHAT-10 form)
MAX_SCORE = 10
LETTERS = ("A", "B", "C", "D", "E")

_FREQ_DAY = ("Many times a day", "A few times a day", "A few times a week", "Less than once a week", "Never")
_ALWAYS = ("Always", "Usually", "Sometimes", "Rarely", "Never")
_EASE = ("Very easy", "Quite easy", "Quite difficult", "Very difficult", "Impossible")
_WORDS1 = ("Very typical", "Quite typical", "Slightly unusual", "Very unusual", "My child doesn't speak")

PL_ALWAYS = {0: "zawsze", 1: "zazwyczaj", 2: "czasami", 3: "rzadko", 4: "nigdy"}
PL_EASE = {0: "b.łatwo", 1: "dość łatwo", 2: "dość trudno", 3: "b. trudno", 4: "niemożliwe"}   # dataset labels 'impossible' as 5 (see audit)
PL_FREQ = {0: "wiele razy/dzień", 1: "kilka razy/dzień", 2: "kilka razy/tydzień", 3: "mniej niż raz/tydzień", 4: "nigdy"}
PL_WORDS = {0: "b.typowe", 1: "całkiem typowe", 2: "trochę niezwykłe", 3: "b.niezwykłe", 4: "nie mówi"}
PL_STARE = {0: "nigdy", 1: "mniej niż raz/tydzień", 2: "kilka razy/tydzień", 3: "kilka razy/dzień", 4: "wiele razy/dzień"}


@dataclass(frozen=True)
class Item:
    id: str                       # Q1..Q10 (position on the Q-CHAT-10 form)
    qchat25: int                  # item number in the 25-item Q-CHAT (Allison 2012, Table 3)
    text: str                     # official English wording
    options: tuple[str, ...]      # labels of options A..E in printed order
    reversed_scale: bool          # True: printed option order runs from most atypical to least (Q10 only)
    short: str                    # short label for explanations
    pl_value_labels: Mapping[int, str]   # expected Polish label of each recoded value in the dataset
    helper: str = ""              # NeuroSense-authored one-line clarification shown under the OFFICIAL wording; never replaces it

    @property
    def dataset_column(self) -> str:
        return f"qchat{self.qchat25}recode"

    def recode(self, letter: str) -> int:
        idx = LETTERS.index(letter)
        return 4 - idx if self.reversed_scale else idx

    def point(self, letter: str) -> int:
        return int(self.recode(letter) >= 2)

    @property
    def point_letters(self) -> tuple[str, ...]:
        return tuple(l for l in LETTERS if self.point(l))


ITEMS: tuple[Item, ...] = (
    Item("Q1", 1, "Does your child look at you when you call his/her name?", _ALWAYS, False, "Looks when name is called", PL_ALWAYS, helper="Think about what usually happens when you say your child's name in an ordinary moment."),
    Item("Q2", 2, "How easy is it for you to get eye contact with your child?", _EASE, False, "Eye contact", PL_EASE, helper="Think about how it usually goes when you try to catch your child's eye."),
    Item("Q3", 5, "Does your child point to indicate that s/he wants something? (e.g. a toy that is out of reach)", _FREQ_DAY, False, "Points to ask for something", PL_FREQ, helper='Think about how your child shows you what they want, in your own words.'),
    Item("Q4", 6, "Does your child point to share interest with you? (e.g. pointing at an interesting sight)", _FREQ_DAY, False, "Points to share interest", PL_FREQ, helper='This is pointing just to show you something, not to ask for it.'),
    Item("Q5", 9, "Does your child pretend? (e.g. care for dolls, talk on a toy phone)", _FREQ_DAY, False, "Pretend play", PL_FREQ, helper='Think about make-believe play, like feeding a doll or talking on a toy phone.'),
    Item("Q6", 10, "Does your child follow where you're looking?", _FREQ_DAY, False, "Follows your gaze", PL_FREQ, helper='Think about whether your child turns to look at what you are looking at.'),
    Item("Q7", 15, "If you or someone else in the family is visibly upset, does your child show signs of wanting to comfort them? (e.g. stroking hair, hugging them)", _ALWAYS, False, "Comforts someone who is upset", PL_ALWAYS, helper='Think about a time when you or someone at home was sad, hurt or crying.'),
    Item("Q8", 17, "Would you describe your child's first words as:", _WORDS1, False, "First words", PL_WORDS, helper='Think about the very first words your child said, not how many words they say now.'),
    Item("Q9", 19, "Does your child use simple gestures? (e.g. wave goodbye)", _FREQ_DAY, False, "Simple gestures", PL_FREQ, helper='A gesture is a hand or body movement that means something, like waving.'),
    Item("Q10", 25, "Does your child stare at nothing with no apparent purpose?", _FREQ_DAY, True, "Stares at nothing", PL_STARE, helper='Think about moments when your child seems to gaze at nothing in particular.'),
)
ITEM_IDS = tuple(i.id for i in ITEMS)
BY_ID = {i.id: i for i in ITEMS}
QCHAT25_ITEM_NUMBERS = tuple(i.qchat25 for i in ITEMS)             # (1, 2, 5, 6, 9, 10, 15, 17, 19, 25)
DATASET_COLUMNS = tuple(i.dataset_column for i in ITEMS)
FEATURE_NAMES = tuple(f"qchat{i.qchat25}" for i in ITEMS)           # model feature names, in this exact order


class AnswerError(ValueError):
    def __init__(self, problems: dict[str, str]):
        self.problems = problems
        super().__init__("; ".join(f"{k}: {v}" for k, v in problems.items()))


def normalise_letter(value) -> str:
    if not isinstance(value, str) or value.strip().upper() not in LETTERS:
        raise ValueError("answer must be one option letter A-E")
    return value.strip().upper()


def validate_answers(answers: Mapping) -> dict[str, str]:
    """-> {Q1..Q10: letter}.  All ten items required; unknown keys rejected; no defaults."""
    problems = {}
    out = {}
    for k in (answers or {}):
        if k not in BY_ID:
            problems[str(k)] = "unknown item (expected Q1..Q10)"
    for item in ITEMS:
        if item.id not in (answers or {}) or answers[item.id] is None:
            problems[item.id] = "missing"
            continue
        try:
            out[item.id] = normalise_letter(answers[item.id])
        except ValueError as exc:
            problems[item.id] = str(exc)
    if problems:
        raise AnswerError(problems)
    return out


def validate_age_months(age_months) -> int:
    if isinstance(age_months, bool) or not isinstance(age_months, int):
        raise ValueError("age in months must be a whole number")
    if not AGE_MONTHS_MIN <= age_months <= AGE_MONTHS_MAX:
        raise ValueError(f"Q-CHAT-10 is for children aged {AGE_MONTHS_MIN}-{AGE_MONTHS_MAX} months; got {age_months}")
    return age_months


def recode_vector(answers: Mapping[str, str]) -> list[int]:
    """The ten recoded values (0-4, higher = more atypical) in Q-CHAT item order 1,2,5,6,9,10,15,17,19,25."""
    a = validate_answers(answers)
    return [BY_ID[i.id].recode(a[i.id]) for i in ITEMS]


NOTICE = ("The Q-CHAT-10 score is the official screening rule (3 or more suggests considering a referral for assessment). It is "
          "not a diagnosis. The separate model output below is a preliminary research model trained on one Polish clinical-vs-"
          "control cohort; it is not validated for NeuroSense's population and does not change the Q-CHAT-10 result.")


def score_qchat10(answers: Mapping[str, str]) -> dict:
    """Official, deterministic Q-CHAT-10 result (server-side)."""
    a = validate_answers(answers)
    items = []
    total = 0
    for it in ITEMS:
        pts = it.point(a[it.id])
        total += pts
        items.append({"id": it.id, "qchat25_item": it.qchat25, "question": it.text, "short": it.short, "answer": a[it.id],
                      "answer_label": it.options[LETTERS.index(a[it.id])], "recode": it.recode(a[it.id]), "points": pts,
                      "scores_on": "option(s) " + "/".join(it.point_letters)})
    # The ARC form defines one cut-point only ("3 or above"); no intermediate band exists in the instrument, so none is invented.
    band = "High" if total >= OFFICIAL_THRESHOLD else "Low"       # internal flag for the shared result contract; the UI shows meets_threshold
    return {"scoring_version": 3, "category": "toddler", "instrument": INSTRUMENT_NAME, "total_score": total, "max_score": MAX_SCORE,
            "threshold": OFFICIAL_THRESHOLD, "threshold_source": "ARC Q-CHAT-10 form: score of 3 or above -> consider referral",
            "meets_threshold": total >= OFFICIAL_THRESHOLD, "risk_band": band,
            "interpretation": ("Score at or above the Q-CHAT-10 cut-point of 3: the form suggests a health professional may consider referral for a fuller assessment."
                               if total >= OFFICIAL_THRESHOLD else
                               "Score below the Q-CHAT-10 cut-point of 3. This does not rule out developmental differences; talk to a health professional if you have concerns."), "items": items,
            "validated_against_clinical_labels": False, "notice": NOTICE}
