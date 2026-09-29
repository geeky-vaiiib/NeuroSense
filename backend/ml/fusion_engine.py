"""Multimodal late-fusion engine for NeuroSense.

Architecture (Genuine Multimodal Fusion):
    final_probability  = weighted_avg(trained_modalities)
    heuristic_signal   = weighted_avg(heuristic_modalities)   [supplemental only]

Since no comprehensive multimodal labeled dataset is currently available to
train a meta-classifier, we use fixed calibrated weights:
    - Questionnaire: 40% (Primary clinical instrument)
    - Gaze: 20% (Supporting digital biomarker)
    - Speech: 20% (Supporting digital biomarker)
    - Facial: 20% (Supporting digital biomarker)

If a modality is missing or running in heuristic mode (not a trained model),
it is excluded from final_probability and the remaining trained modalities
are proportionally scaled. This ensures final_probability is ONLY driven
by genuine trained ML models.

The heuristic signal (for transparency) is computed from any untrained
(rule-based) modalities that were present.
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# No multimodal-labeled training dataset is available in this repository.
# Therefore, we use fixed calibrated weights instead of a trained meta-classifier.
_FUSION_MODEL = None

# ── Genuine Multimodal Weights ───────────────────────────────────────────────
# Fixed calibrated weights. Used for both trained fusion and heuristic signal.
_WEIGHT_Q = 0.40
_WEIGHT_G = 0.20
_WEIGHT_S = 0.20
_WEIGHT_F = 0.20

# Category-specific risk thresholds (mirror model.py _classify_risk)
_TODDLER_HIGH = 0.55
_TODDLER_MODERATE = 0.30
_DEFAULT_HIGH = 0.70
_DEFAULT_MODERATE = 0.40


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class ModalityComponent:
    """Per-modality contribution to the fusion result."""
    modality: str           # "questionnaire" | "gaze" | "speech"
    score: float            # 0.0–1.0
    method: str             # "supervised_ml" | "rule_based_heuristic" | etc.
    is_trained_model: bool  # True only when a real trained checkpoint is in use
    modality_label: str     # Human-readable label
    available: bool = True  # False when step was skipped / data insufficient


@dataclass
class FusionResult:
    """Complete output of the multimodal fusion step."""

    # Primary output
    final_probability: float         # Drives risk_level — P(Q) under Option A
    risk_level: str                  # "High" | "Moderate" | "Low"

    # Component breakdown
    questionnaire_probability: float
    gaze_score: Optional[float] = None
    speech_score: Optional[float] = None
    facial_score: Optional[float] = None
    heuristic_signal: Optional[float] = None  # weighted_avg(H(G), H(S), H(F))

    # Transparency
    modality_breakdown: list = field(default_factory=list)
    modalities_used: int = 1
    confidence_note: str = ""

    # Backward-compat alias
    fusion_score: float = 0.0


# ── Public API ────────────────────────────────────────────────────────────────

def fuse(
    questionnaire_probability: float,
    gaze_result: Optional[dict] = None,
    speech_result: Optional[dict] = None,
    facial_result: Optional[dict] = None,
    category: str = "adult",
) -> FusionResult:
    """Perform multimodal late fusion and return a FusionResult.

    Parameters
    ----------
    questionnaire_probability : float
        The 0-1 ASD probability from the trained questionnaire ML model.
    gaze_result : dict | None
        Output from gaze_engine.compute_gaze_score(), or None if skipped.
    speech_result : dict | None
        Output from speech_engine.compute_speech_score(), or None if skipped.
    facial_result : dict | None
        Output from facial_engine.compute_facial_score(), or None if skipped.
    category : str
        "adult", "child", or "toddler".
    """
    questionnaire_probability = max(0.0, min(1.0, float(questionnaire_probability)))

    breakdown: list[ModalityComponent] = []

    # Questionnaire — always present, always trained
    breakdown.append(ModalityComponent(
        modality="questionnaire",
        score=round(questionnaire_probability, 4),
        method="supervised_ml",
        is_trained_model=True,
        modality_label="Questionnaire (ML Classifier — UCI/Kaggle ASD Dataset)",
        available=True,
    ))

    # Gaze
    gaze_score: Optional[float] = None
    gaze_is_trained = False
    if gaze_result is not None:
        raw = gaze_result.get("score")
        gaze_is_trained = bool(gaze_result.get("is_trained_model", False))
        if raw is not None:
            gaze_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=gaze_score,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=gaze_is_trained,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=0.0,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="gaze",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
            available=False,
        ))

    # Speech
    speech_score: Optional[float] = None
    speech_is_trained = False
    if speech_result is not None:
        raw = speech_result.get("score")
        speech_is_trained = bool(speech_result.get("is_trained_model", False))
        if raw is not None:
            speech_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="speech",
                score=speech_score,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=speech_is_trained,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="speech",
                score=0.0,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="speech",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Speech Analysis (Research Heuristic — Bone et al. 2014)",
            available=False,
        ))

    # Facial
    facial_score: Optional[float] = None
    facial_is_trained = False
    if facial_result is not None:
        raw = facial_result.get("score")
        facial_is_trained = bool(facial_result.get("is_trained_model", False))
        if raw is not None:
            facial_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="facial",
                score=facial_score,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=facial_is_trained,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="facial",
                score=0.0,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="facial",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Facial Analysis (Research Heuristic)",
            available=False,
        ))

    # Separate trained vs heuristic auxiliary signals
    heuristic_parts: list[tuple[float, float]] = []
    
    # The questionnaire is ALWAYS trained and ALWAYS present
    trained_parts: list[tuple[float, float]] = [
        (_WEIGHT_Q, questionnaire_probability)
    ]

    if gaze_score is not None:
        if gaze_is_trained:
            trained_parts.append((_WEIGHT_G, gaze_score))
        else:
            heuristic_parts.append((_WEIGHT_G, gaze_score))
            
    if speech_score is not None:
        if speech_is_trained:
            trained_parts.append((_WEIGHT_S, speech_score))
        else:
            heuristic_parts.append((_WEIGHT_S, speech_score))
            
    if facial_score is not None:
        if facial_is_trained:
            trained_parts.append((_WEIGHT_F, facial_score))
        else:
            heuristic_parts.append((_WEIGHT_F, facial_score))

    # Heuristic signal (supplemental, does not affect final_probability)
    heuristic_signal: Optional[float] = None
    if heuristic_parts:
        total_w = sum(w for w, _ in heuristic_parts)
        heuristic_signal = round(
            sum(w * s for w, s in heuristic_parts) / total_w, 4
        )

    # Final probability: uses meta-classifier if available, otherwise genuine weighted multimodal fusion
    if _FUSION_MODEL is not None:
        import numpy as np
        # Feature vector: [q_prob, gaze_prob, speech_prob, facial_prob]
        # Impute missing values with 0.5 (neutral)
        X = np.array([[
            questionnaire_probability,
            gaze_score if gaze_score is not None else 0.5,
            speech_score if speech_score is not None else 0.5,
            facial_score if facial_score is not None else 0.5,
        ]])
        final_probability = round(float(_FUSION_MODEL.predict_proba(X)[0, 1]), 4)
    else:
        # Genuine Multimodal Fusion
        total_w = sum(w for w, _ in trained_parts)
        final_probability = round(sum(w * s for w, s in trained_parts) / total_w, 4)

    risk_level = _classify_risk(final_probability, category)
    
    has_trained_aux = len(trained_parts) > 1
    confidence_note = _build_confidence_note(
        gaze_score, speech_score, facial_score,
        gaze_is_trained, speech_is_trained, facial_is_trained,
        heuristic_signal, has_trained_aux,
    )

    modalities_used = (
        1
        + (1 if gaze_score is not None else 0)
        + (1 if speech_score is not None else 0)
        + (1 if facial_score is not None else 0)
    )

    return FusionResult(
        final_probability=final_probability,
        risk_level=risk_level,
        questionnaire_probability=round(questionnaire_probability, 4),
        gaze_score=gaze_score,
        speech_score=speech_score,
        facial_score=facial_score,
        heuristic_signal=heuristic_signal,
        modality_breakdown=breakdown,
        modalities_used=modalities_used,
        confidence_note=confidence_note,
        fusion_score=final_probability,
    )


def modality_breakdown_as_dicts(breakdown: list) -> list[dict]:
    """Convert ModalityComponent list to JSON-serialisable dicts."""
    return [
        {
            "modality": c.modality,
            "score": c.score,
            "method": c.method,
            "isTrainedModel": c.is_trained_model,
            "modalityLabel": c.modality_label,
            "available": c.available,
        }
        for c in breakdown
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_risk(prob: float, category: str) -> str:
    if category == "toddler":
        if prob >= _TODDLER_HIGH:
            return "High"
        if prob >= _TODDLER_MODERATE:
            return "Moderate"
        return "Low"
    if prob >= _DEFAULT_HIGH:
        return "High"
    if prob >= _DEFAULT_MODERATE:
        return "Moderate"
    return "Low"


def _build_confidence_note(
    gaze_score: Optional[float],
    speech_score: Optional[float],
    facial_score: Optional[float],
    gaze_is_trained: bool,
    speech_is_trained: bool,
    facial_is_trained: bool,
    heuristic_signal: Optional[float],
    has_trained_aux: bool,
) -> str:
    parts: list[str] = []
    if _FUSION_MODEL is not None:
        parts.append(
            "Final probability is computed by a trained meta-classifier that dynamically "
            "fuses available multimodal features (Questionnaire, Gaze, Speech, Facial)."
        )
    elif has_trained_aux:
        aux = []
        if gaze_is_trained: aux.append("Gaze")
        if speech_is_trained: aux.append("Speech")
        if facial_is_trained: aux.append("Facial")
        aux_str = ", ".join(aux)
        parts.append(
            f"Final probability is a genuine multimodal fusion of the Questionnaire and "
            f"available trained auxiliary models ({aux_str}), using calibrated fixed weights."
        )
    else:
        parts.append(
            "Final probability and risk level are driven exclusively by the "
            "trained questionnaire ML classifier."
        )
    if gaze_score is not None and not gaze_is_trained:
        parts.append(
            "Eye-gaze analysis uses a clinical research heuristic "
            "(Jones & Klin 2013) — not a trained ML model. "
            "No labeled gaze+ASD training data is available in this system."
        )
    if speech_score is not None and not speech_is_trained:
        parts.append(
            "Speech analysis uses a clinical research heuristic "
            "(Bone et al. 2014) — not a trained ML model. "
            "No labeled speech+ASD training data is available in this system."
        )
    if facial_score is not None and not facial_is_trained:
        parts.append(
            "Facial analysis uses a clinical research heuristic "
            "— not a trained ML model. "
            "No labeled facial+ASD training data is available in this system."
        )
    if heuristic_signal is not None:
        parts.append(
            f"Supplemental heuristic signal (gaze/speech/facial combined): "
            f"{heuristic_signal:.3f} — shown for research context only, "
            f"does not affect the risk classification."
        )
    return " ".join(parts)
