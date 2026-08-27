"""Multimodal late-fusion engine for NeuroSense.

Architecture (Option A — Scientifically Conservative):
    final_probability  = P(Q)          [questionnaire ML model — trained]
    heuristic_signal   = weighted_avg(H(G), H(S))   [supplemental only]

P(Q) is the only trained probability in the system.  Gaze (H(G)) and
speech (H(S)) are rule-based research heuristics (Jones & Klin 2013;
Bone et al. 2014) with no labeled ASD training data in this repository.
They are NEVER represented as trained ML probabilities.

The risk_level and final_probability are driven exclusively by P(Q).
Heuristic signals appear in modality_breakdown with is_trained_model=False
so the frontend and clinicians have full transparency.

Hot-swap behaviour:
    When gaze_lstm.pt / speech_cnn.pt are loaded in the respective engines,
    those engines will set is_trained_model=True.  fusion_engine will then
    include them in a weighted blend (60% questionnaire + 40% trained aux)
    because they represent genuine trained probabilities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# ── Heuristic weight constants ───────────────────────────────────────────────
# Used ONLY when computing heuristic_signal (supplemental signal).
# These do NOT affect final_probability (P(Q) only under Option A).
_GAZE_HEURISTIC_WEIGHT = 0.57
_SPEECH_HEURISTIC_WEIGHT = 0.43

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
    heuristic_signal: Optional[float] = None  # weighted_avg(H(G), H(S))

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

    # Separate trained vs heuristic auxiliary signals
    heuristic_parts: list[tuple[float, float]] = []
    trained_parts: list[tuple[float, float]] = []

    if gaze_score is not None:
        (trained_parts if gaze_is_trained else heuristic_parts).append(
            (_GAZE_HEURISTIC_WEIGHT, gaze_score)
        )
    if speech_score is not None:
        (trained_parts if speech_is_trained else heuristic_parts).append(
            (_SPEECH_HEURISTIC_WEIGHT, speech_score)
        )

    # Heuristic signal (supplemental, does not affect final_probability)
    heuristic_signal: Optional[float] = None
    if heuristic_parts:
        total_w = sum(w for w, _ in heuristic_parts)
        heuristic_signal = round(
            sum(w * s for w, s in heuristic_parts) / total_w, 4
        )

    # Final probability: P(Q) under Option A; blends in trained aux if present
    if trained_parts:
        total_w = sum(w for w, _ in trained_parts)
        blended_other = sum((w / total_w) * 0.40 * s for w, s in trained_parts)
        final_probability = round(
            max(0.0, min(1.0, 0.60 * questionnaire_probability + blended_other)), 4
        )
    else:
        final_probability = round(questionnaire_probability, 4)

    risk_level = _classify_risk(final_probability, category)
    confidence_note = _build_confidence_note(
        gaze_score, speech_score,
        gaze_is_trained, speech_is_trained,
        heuristic_signal, bool(trained_parts),
    )

    modalities_used = (
        1
        + (1 if gaze_score is not None else 0)
        + (1 if speech_score is not None else 0)
    )

    return FusionResult(
        final_probability=final_probability,
        risk_level=risk_level,
        questionnaire_probability=round(questionnaire_probability, 4),
        gaze_score=gaze_score,
        speech_score=speech_score,
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
    gaze_is_trained: bool,
    speech_is_trained: bool,
    heuristic_signal: Optional[float],
    has_trained_aux: bool,
) -> str:
    parts: list[str] = []
    if has_trained_aux:
        parts.append(
            "Final probability is a weighted blend of the questionnaire ML "
            "classifier (60%) and additional trained modality models (40%)."
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
    if heuristic_signal is not None:
        parts.append(
            f"Supplemental heuristic signal (gaze/speech combined): "
            f"{heuristic_signal:.3f} — shown for research context only, "
            f"does not affect the risk classification."
        )
    return " ".join(parts)
