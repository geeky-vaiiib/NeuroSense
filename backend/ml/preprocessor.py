"""
ml/preprocessor.py — Clean and encode screening input features for inference.

Transforms the raw ScreeningRequest into a feature vector matching
the training pipeline's expectations.

Supports adult, child, and toddler categories.
"""

from typing import Optional

import numpy as np

# Item scoring lives in ml/questionnaire_score.py (single, strict implementation).
try:
    from .questionnaire_score import score_items
except ImportError:  # pragma: no cover - backend/ as cwd
    from ml.questionnaire_score import score_items

# ── Gender maps ───────────────────────────────────────────────────
GENDER_MAP = {
    "Male": 1,
    "Female": 0,
    "Non-binary": 2,
    "Prefer not to say": 3,
}

TODDLER_GENDER_MAP = {
    "Male": 1,
    "Female": 0,
    "Non-binary": 2,
    "Prefer not to say": 3,
    "m": 1,
    "f": 0,
}


def encode_aq10_scores(answers: dict, category: str = "adult") -> list[int]:
    """Item points (0/1) for A1..A10 - strict: raises questionnaire_score.AnswerError on missing/invalid answers."""
    return score_items(category, answers)


def preprocess_for_inference(
    demo: dict,
    answers: dict,
    encoders: Optional[dict] = None,
    category: str = "adult",
) -> np.ndarray:
    """
    Build the feature vector from demographics + AQ-10/Q-CHAT-10 answers.

    Feature order (must match training — same for all categories):
      [A1_Score, A2_Score, ..., A10_Score, age, gender, jaundice, family_asd, ethnicity]

    For toddler: age is converted from years to months (model trained on Age_Mons).

    Returns: np.ndarray of shape (1, 15)
    """
    # AQ-10 / Q-CHAT-10 binary scores
    aq_scores = encode_aq10_scores(answers, category=category)

    # Age — toddler model was trained on months, so convert years → months
    age = int(demo.get("age", 25))
    if category == "toddler":
        age = age * 12

    # Gender
    gender_raw = demo.get("gender", "Prefer not to say")
    if category == "toddler":
        gender = TODDLER_GENDER_MAP.get(gender_raw, 3)
    else:
        gender = GENDER_MAP.get(gender_raw, 3)

    # Jaundice
    jaundice = 1 if demo.get("jaundice") == "Yes" else 0

    # Family history
    family_asd = 1 if demo.get("familyAsd", demo.get("family_asd")) == "Yes" else 0

    # Ethnicity — use label encoder if available, else default to 0
    ethnicity_raw = demo.get("ethnicity", "Other")
    if encoders and "ethnicity" in encoders:
        try:
            ethnicity = int(encoders["ethnicity"].transform([ethnicity_raw])[0])
        except (ValueError, KeyError):
            ethnicity = 0
    else:
        ethnicity = 0

    if category == "toddler":
        features = aq_scores + [age, gender, jaundice, family_asd, ethnicity]
    else:
        features = aq_scores + [age, gender, ethnicity, jaundice, family_asd]
    return np.array(features, dtype=np.float64).reshape(1, -1)


def feature_names_for(category: str) -> list[str]:
    """Names in the EXACT column order of preprocess_for_inference / the training matrix."""
    items = [f"A{i}_Score" for i in range(1, 11)]
    if category == "toddler":
        return items + ["Age", "Gender", "Jaundice", "Family_ASD", "Ethnicity"]
    return items + ["Age", "Gender", "Ethnicity", "Jaundice", "Family_ASD"]
