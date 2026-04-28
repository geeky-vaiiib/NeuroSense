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
        "modality_confidence": [
            {"id": "questionnaire", "label": "Adult self-report", "pct": 84},
            {"id": "demographics", "label": "Adult demographics", "pct": 72},
            {"id": "family-history", "label": "Family history signal", "pct": 66},
            {"id": "xai-ready", "label": "Explainability readiness", "pct": 91},
        ],
    },
    "child": {
        "label": "Child",
        "age_min": 5,
        "age_max": 17,
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
        "modality_confidence": [
            {"id": "questionnaire", "label": "Caregiver questionnaire", "pct": 81},
            {"id": "developmental-history", "label": "Developmental history", "pct": 78},
            {"id": "birth-context", "label": "Birth and family context", "pct": 69},
            {"id": "xai-ready", "label": "Explainability readiness", "pct": 93},
        ],
    },
    "toddler": {
        "label": "Toddler",
        "age_min": 0,
        "age_max": 4,
        "screening_tool": "Q-CHAT-10",
        "respondent_relationship": "Parent / Guardian",
        "risk_copy": {
            "High": (
                "This caregiver-completed toddler screening shows a high concentration of "
                "early ASD-related traits. A developmental paediatrician review is recommended "
                "as early as possible \u2014 early intervention between 18 and 24 months produces "
                "the best long-term outcomes."
            ),
            "Moderate": (
                "This caregiver-completed toddler screening shows several early traits associated "
                "with ASD. A paediatric follow-up assessment is recommended."
            ),
            "Low": (
                "This caregiver-completed toddler screening shows fewer early ASD-related traits "
                "at this time. Continue routine developmental monitoring at each well-child visit."
            ),
        },
        "diagnosis_copy": {
            "High": "Toddler early ASD traits flagged \u2014 urgent developmental review recommended",
            "Moderate": "Toddler early ASD traits present \u2014 paediatric review recommended",
            "Low": "Lower toddler ASD likelihood on screening",
        },
        "modality_confidence": [
            {"id": "questionnaire", "label": "Q-CHAT-10 caregiver report", "pct": 88},
            {"id": "developmental-history", "label": "Early developmental milestones", "pct": 82},
            {"id": "birth-context", "label": "Birth and family context", "pct": 74},
            {"id": "xai-ready", "label": "Explainability readiness", "pct": 91},
        ],
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
        "A1_Score": "Child notices small sounds",
        "A2_Score": "Child focuses on the whole picture",
        "A3_Score": "Child handles multitasking",
        "A4_Score": "Child returns to tasks after interruption",
        "A5_Score": "Child reads implied meaning in conversation",
        "A6_Score": "Child recognises when others are disengaged",
        "A7_Score": "Child interprets characters' intentions",
        "A8_Score": "Child collects detailed categories of information",
        "A9_Score": "Child reads thoughts from facial cues",
        "A10_Score": "Child understands other people's intentions",
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
    return "child" if age < 18 else "adult"


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


def build_case_tags(category: str, risk_level: str, is_mock: bool) -> list[str]:
    """Build default tags for a case record."""
    if category == "adult":
        report_type = "self-report"
    else:
        report_type = "caregiver-report"

    tags = [
        f"{category}-track",
        report_type,
        f"{risk_level.lower()}-risk",
        "mock-pipeline" if is_mock else "live-model",
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


def modality_confidence_for_category(category: str | None = None) -> list[dict]:
    """Return dashboard confidence cards for a category or mixed overview."""
    if category in CATEGORY_SETTINGS:
        return CATEGORY_SETTINGS[category]["modality_confidence"]

    return [
        {"id": "adult-track",   "label": "Adult self-report",      "pct": 84},
        {"id": "child-track",   "label": "Child caregiver report",  "pct": 81},
        {"id": "toddler-track", "label": "Toddler Q-CHAT-10",       "pct": 88},
        {"id": "routing",       "label": "Category model routing",  "pct": 89},
    ]
