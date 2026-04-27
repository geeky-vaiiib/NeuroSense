"""Central category registry, validation, and category-aware copy helpers."""

from __future__ import annotations

from typing import Literal

ScreeningCategory = Literal["adult", "child"]


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
        "age_min": 0,
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

    inferred = derive_category_from_age(age)
    if inferred != category:
        expected_label = category_label(category)
        inferred_label = category_label(inferred)
        raise ValueError(
            f"{expected_label} screening does not match age {age}. "
            f"Age {age} belongs to the {inferred_label.lower()} category."
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
    tags = [
        f"{category}-track",
        "self-report" if category == "adult" else "caregiver-report",
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
        {"id": "adult-track", "label": "Adult self-report", "pct": 84},
        {"id": "child-track", "label": "Caregiver report", "pct": 81},
        {"id": "routing", "label": "Category model routing", "pct": 89},
        {"id": "xai-ready", "label": "Explainability readiness", "pct": 92},
    ]
