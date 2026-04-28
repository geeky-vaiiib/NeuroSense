"""
ml/preprocessor.py — Clean and encode screening input features for inference.

Transforms the raw ScreeningRequest into a feature vector matching
the training pipeline's expectations.

Supports adult, child, and toddler categories.
"""

from typing import Optional

import numpy as np
import joblib
import os

# ── AQ-10 scoring (adult / child) ─────────────────────────────────
# ASD-trait questions — agree variants score 1
ASD_TRAIT_IDS = {"A1", "A7", "A8", "A10"}

ANSWER_MAP = {
    "Definitely agree": 1,
    "Slightly agree": 1,
    "Definitely disagree": 0,
    "Slightly disagree": 0,
}

# ── Q-CHAT-10 scoring (toddler) ──────────────────────────────────
# For toddler Q-CHAT-10, only A10 is the ASD-trait direction question.
# A1–A9: disagree = 1 (typical behavior absent = concerning)
# A10:   agree = 1 (atypical behavior present = concerning)
QCHAT_TRAIT_IDS = {"A10"}

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
    """
    Convert AQ-10 / Q-CHAT-10 answers to binary scores (0 or 1).

    Adult / Child (AQ-10):
        For ASD-trait questions (A1, A7, A8, A10): agree = 1
        For non-trait questions: disagree = 1

    Toddler (Q-CHAT-10):
        For A1–A9: disagree = 1 (typical behavior absent = concerning)
        For A10:   agree = 1 (atypical behavior present = concerning)
    """
    trait_ids = QCHAT_TRAIT_IDS if category == "toddler" else ASD_TRAIT_IDS

    scores = []
    for i in range(1, 11):
        key = f"A{i}"
        raw = answers.get(key, "Slightly disagree")
        is_agree = ANSWER_MAP.get(raw, 0)
        if key in trait_ids:
            scores.append(is_agree)
        else:
            scores.append(1 - is_agree)
    return scores


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

    features = aq_scores + [age, gender, jaundice, family_asd, ethnicity]
    return np.array(features, dtype=np.float64).reshape(1, -1)
