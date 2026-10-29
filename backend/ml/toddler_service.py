"""Authoritative toddler questionnaire service (validation -> official score -> model output -> explanation).

1. validates the questionnaire type, the age in months (18-24) and every answer (ten items, one letter A-E each);
2. computes the OFFICIAL Q-CHAT-10 score deterministically (ml/qchat10.py);
3. separately runs the trained cohort model with the exact training-time feature builder (ml/toddler_model.py);
4. returns the two clearly distinguished blocks.  The model output never changes the official result, and if the checkpoint is
   missing/corrupt the official score is still returned with an honest unavailable model block (no fallback probability).
"""

from __future__ import annotations

from typing import Optional

try:
    from . import qchat10 as Q
    from . import toddler_model as TM
except ImportError:  # pragma: no cover
    from ml import qchat10 as Q
    from ml import toddler_model as TM

CAVEATS = (
    "Preliminary research model trained on one Polish cohort (252 children, ages 18-24 months; ASD group vs controls, recruited through different channels).",
    "The value is a calibrated similarity to that cohort's ASD-group responses, NOT the probability that this child has autism: the cohort is about 54% ASD, far above any real population.",
    "Not validated for NeuroSense's population or language; it did not demonstrably outperform the official Q-CHAT-10 score.",
)


def _unavailable(reason: str) -> dict:
    return {"available": False, "reason": reason, "role": "preliminary model output (does not affect the Q-CHAT-10 result)"}


def model_status() -> dict:
    try:
        m = TM.load_model()
    except Exception as exc:
        return {"available": False, "reason": str(exc)}
    return {"available": True, "model_version": m.version, "algorithm": m.meta["algorithm"], "config": m.meta["config"],
            "validated_for_deployment": False}


def analyze(answers: dict, age_months: int, female: Optional[bool]) -> dict:
    """-> {"screening": official score block, "model": model block, "normalised_answers": {...}}.  Raises ValueError/AnswerError on bad input."""
    a = Q.validate_answers(answers)
    months = Q.validate_age_months(age_months)
    screening = Q.score_qchat10(a)
    try:
        m = TM.load_model()
        x = m.features(Q.recode_vector(a), age_months=months, female=female)
        p = round(m.predict_proba(x), 4)
        ev = m.meta["metrics"]
        model = {"available": True, "model_version": m.version, "model_used": m.version, "algorithm": m.meta["algorithm"], "config": m.meta["config"],
                 "value": p, "probability": p, "decision_threshold": round(m.threshold, 4), "above_threshold": p >= m.threshold,
                 "meaning": "calibrated similarity to the Polish cohort's ASD-group responses (not a population risk)",
                 "role": "preliminary model output (does not affect the Q-CHAT-10 result)", "validated_for_deployment": False,
                 "evaluation": {"dev_nested_cv_auc": ev["dev_oof"]["roc_auc"], "dev_auc_ci95": ev["dev_oof_ci95"]["roc_auc"],
                                "holdout_n": ev["holdout_once"]["n"], "holdout_auc": ev["holdout_once"]["roc_auc"], "holdout_auc_ci95": ev["holdout_ci95"]["roc_auc"],
                                "holdout_sensitivity": ev["holdout_once"]["sensitivity"], "holdout_sensitivity_ci95": ev["holdout_ci95"]["sensitivity"],
                                "holdout_specificity": ev["holdout_once"]["specificity"], "holdout_specificity_ci95": ev["holdout_ci95"]["specificity"],
                                "official_rule_holdout_auc": ev["baselines_holdout"]["official_points_auc"]},
                 "caveats": list(CAVEATS), "dataset": m.meta["dataset"]["citation"]}
    except Exception as exc:                       # missing/corrupt checkpoint, unexpected inputs: honest unavailable state
        model = _unavailable(f"toddler questionnaire model unavailable: {exc}")
    return {"screening": screening, "model": model, "normalised_answers": a}


def explain(answers: dict, age_months: int, female: Optional[bool]) -> Optional[dict]:
    """SHAP for the loaded model and these answers; None if the model cannot run (never placeholder values)."""
    try:
        m = TM.load_model()
        a = Q.validate_answers(answers)
        return {**m.explain(m.features(Q.recode_vector(a), age_months=age_months, female=female)), "model_version": m.version}
    except Exception:
        return None
