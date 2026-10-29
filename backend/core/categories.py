"""Central category registry, validation, and category-aware copy helpers."""

from __future__ import annotations

from typing import Literal

ScreeningCategory = Literal["adult", "child", "toddler"]


CATEGORY_SETTINGS: dict[str, dict] = {
    "adult": {
        "label": "Adult",
        "age_min": 18,
        "age_max": None,
        "screening_tool": "Adult AQ-10",
        "respondent_relationship": "Self",
        "risk_copy": {
            "High": (
                "This adult self-report screening shows a high concentration of ASD-related "
                "traits. A clinician-led adult follow-up assessment is recommended."
            ),
            "Moderate": (
                "This adult self-report screening shows several ASD-related traits. A structured "
                "adult follow-up assessment may be helpful."
            ),
            "Low": (
                "This adult self-report screening shows a lower concentration of ASD-related "
                "traits at this time. Continue monitoring if concerns remain."
            ),
        },
        "diagnosis_copy": {
            "High": "Adult ASD traits flagged — follow-up recommended",
            "Moderate": "Adult ASD traits present — review recommended",
            "Low": "Lower adult ASD likelihood on screening",
        },
    },
    "child": {
        "label": "Child",
        "age_min": 4,          # AQ-10 child (caregiver) form: ages 4-11 (matches the UI)
        "age_max": 11,
        "screening_tool": "Child AQ-10",
        "respondent_relationship": "Parent / Guardian",
        "risk_copy": {
            "High": (
                "This caregiver-completed child screening shows a high concentration of "
                "ASD-related traits. A developmental specialist review is recommended."
            ),
            "Moderate": (
                "This caregiver-completed child screening shows several traits associated with "
                "ASD. A pediatric follow-up assessment may be helpful."
            ),
            "Low": (
                "This caregiver-completed child screening shows fewer ASD-related traits at this "
                "time. Continue routine developmental monitoring if concerns remain."
            ),
        },
        "diagnosis_copy": {
            "High": "Child ASD traits flagged — developmental follow-up recommended",
            "Moderate": "Child ASD traits present — monitoring recommended",
            "Low": "Lower child ASD likelihood on screening",
        },
    },
    "toddler": {
        "label": "Toddler",
        "age_min": 0,          # age in YEARS is derived from months; the instrument range (18-24 months) is enforced in ml/qchat10.py
        "age_max": 4,
        "screening_tool": "Q-CHAT-10",
        "respondent_relationship": "Parent / Guardian",
        "risk_copy": {
            "High": (
                "On this caregiver-completed Q-CHAT-10 the score is at or above the screening threshold. This is a screening "
                "result, not a diagnosis: discussing it with a paediatrician or developmental specialist about whether a "
                "developmental assessment is appropriate is suggested."
            ),
            "Moderate": (
                "On this caregiver-completed Q-CHAT-10 the score is one point below the screening threshold. This is a screening "
                "result, not a diagnosis: if you have concerns, mention them at your next well-child visit."
            ),
            "Low": (
                "On this caregiver-completed Q-CHAT-10 the score is below the screening threshold. A screening result cannot rule "
                "out autism: if you have concerns, raise them with a health professional."
            ),
        },
        "diagnosis_copy": {
            "High": "Toddler early ASD traits flagged \u2014 urgent developmental review recommended",
            "Moderate": "Toddler early ASD traits present \u2014 paediatric review recommended",
            "Low": "Lower toddler ASD likelihood on screening",
        },
    },
}


FEATURE_LABELS: dict[str, dict[str, str]] = {
    "adult": {
        "A1_Score": "Sensitivity to small sounds",
        "A2_Score": "Whole-picture focus",
        "A3_Score": "Multitasking ease",
        "A4_Score": "Task switching after interruption",
        "A5_Score": "Reading between the lines",
        "A6_Score": "Recognising when others are disengaged",
        "A7_Score": "Interpreting characters' intentions",
        "A8_Score": "Collecting detailed categories of information",
        "A9_Score": "Reading thoughts from facial cues",
        "A10_Score": "Understanding other people's intentions",
        "Age": "Adult age at screening",
        "Gender": "Reported gender",
        "Jaundice": "Neonatal jaundice history",
        "Family_ASD": "Family ASD history",
        "Ethnicity": "Reported ethnicity",
    },
    "child": {
        "A1_Score": "Notices small sounds others do not",
        "A2_Score": "Focuses on the whole picture rather than details",
        "A3_Score": "Keeps track of several conversations in a group",
        "A4_Score": "Switches easily between activities",
        "A5_Score": "Struggles to keep a conversation going with peers",
        "A6_Score": "Good at social chit-chat",
        "A7_Score": "Struggles to work out a story character's intentions or feelings",
        "A8_Score": "Enjoyed pretend play in preschool",
        "A9_Score": "Reads what someone thinks or feels from their face",
        "A10_Score": "Finds it hard to make new friends",
        "Age": "Child age at screening",
        "Gender": "Child's reported gender",
        "Jaundice": "Birth jaundice history",
        "Family_ASD": "Family ASD history",
        "Ethnicity": "Child's reported ethnicity",
    },
    "toddler": {
        "A1_Score": "Child notices sounds others do not (e.g., vacuum cleaner, music)",
        "A2_Score": "Child concentrates on whole objects rather than parts",
        "A3_Score": "Child can do several things at once",
        "A4_Score": "Child returns to an activity after being distracted",
        "A5_Score": "Child can tell what people mean even if they do not say it directly",
        "A6_Score": "Child can tell if someone listening to them is bored",
        "A7_Score": "Child can tell what characters in stories are thinking or feeling",
        "A8_Score": "Child likes to collect things (e.g., stones, stickers, cards)",
        "A9_Score": "Child can work out what someone is thinking just by looking at them",
        "A10_Score": "Child finds it hard to understand what people intend",
        "Age": "Child age in months",
        "Gender": "Child's reported sex",
        "Jaundice": "History of neonatal jaundice",
        "Family_ASD": "Family history of ASD",
        "Ethnicity": "Child's reported ethnicity",
    },
}


def category_label(category: str) -> str:
    """Return the display label for a category."""
    return CATEGORY_SETTINGS.get(category, CATEGORY_SETTINGS["adult"])["label"]


def screening_tool_for_category(category: str) -> str:
    """Return the primary screening tool label for a category."""
    return CATEGORY_SETTINGS.get(category, CATEGORY_SETTINGS["adult"])["screening_tool"]


def default_respondent_relationship(category: str) -> str:
    """Return the default respondent relationship for a category."""
    return CATEGORY_SETTINGS.get(category, CATEGORY_SETTINGS["adult"])["respondent_relationship"]


def derive_category_from_age(age: int) -> ScreeningCategory:
    """Infer category from age using the product rule."""
    if age <= 4:
        return "toddler"
    if age < 18:
        return "child"
    return "adult"


def validate_age_for_category(category: str, age: int) -> None:
    """Validate that age and category are coherent."""
    if category not in CATEGORY_SETTINGS:
        raise ValueError(f"Unsupported category '{category}'.")

    settings = CATEGORY_SETTINGS[category]
    age_min = settings["age_min"]
    age_max = settings["age_max"]

    if age_min is not None and age < age_min:
        raise ValueError(
            f"{settings['label']} screening requires age ≥ {age_min}, got {age}."
        )
    if age_max is not None and age > age_max:
        raise ValueError(
            f"{settings['label']} screening requires age ≤ {age_max}, got {age}."
        )


def build_interpretation(category: str, risk_level: str) -> str:
    """Return category-aware result interpretation copy."""
    category_copy = CATEGORY_SETTINGS.get(category, CATEGORY_SETTINGS["adult"])["risk_copy"]
    return category_copy.get(risk_level, category_copy["Low"])


def build_diagnosis_summary(category: str, risk_level: str) -> str:
    """Return a short category-aware diagnostic summary label."""
    category_copy = CATEGORY_SETTINGS.get(category, CATEGORY_SETTINGS["adult"])["diagnosis_copy"]
    return category_copy.get(risk_level, category_copy["Low"])


def build_case_tags(category: str, risk_level: str, is_mock: bool, score_rule: bool = False) -> list[str]:
    """Build default tags for a case record."""
    if category == "adult":
        report_type = "self-report"
    else:
        report_type = "caregiver-report"

    tags = [
        f"{category}-track",
        report_type,
        f"{risk_level.lower()}-risk",
        "mock-pipeline" if is_mock else ("score-rule" if score_rule else "live-model"),
    ]
    return tags


def build_initial_notes(category: str, age: int) -> str:
    """Build a default note for newly created screenings."""
    if category == "adult":
        return (
            f"Adult self-report submitted at age {age}. Awaiting clinician review and "
            "adult-context interpretation."
        )
    if category == "toddler":
        return (
            f"Caregiver-completed Q-CHAT-10 submitted for toddler aged approximately {age} months. "
            "Awaiting developmental review and early-intervention context assessment."
        )
    return (
        f"Caregiver-completed child screening submitted for age {age}. Awaiting developmental "
        "review and child-context interpretation."
    )


def feature_label(feature_name: str, category: str) -> str:
    """Map technical feature names to category-aware display labels."""
    labels = FEATURE_LABELS.get(category, FEATURE_LABELS["adult"])
    return labels.get(feature_name, feature_name.replace("_", " "))
