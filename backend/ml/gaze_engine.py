"""Gaze modality adapter for the fusion pipeline.

All preprocessing, quality gating and inference live in ``ml/gaze`` (see
``gaze_model_service.py``).  This module only keeps the historical
``compute_gaze_score`` entry point used by ``preprocessing_pipeline``.

There is no heuristic fallback: if the trained browser-compatible checkpoint
cannot legitimately score the session, ``score`` is ``None`` and fusion treats
gaze as unavailable (never as probability 0).
"""

from __future__ import annotations

from typing import Optional

try:
    from .gaze.gaze_model_service import get_gaze_service
except ImportError:  # pragma: no cover - top-level import from backend/
    from ml.gaze.gaze_model_service import get_gaze_service


def compute_gaze_score(gaze_session: Optional[dict], category: str = "child") -> dict:
    """Score a canonical gaze session dict (see schemas/gaze.py GazeAnalyzeRequest)."""
    if not gaze_session:
        raise ValueError("compute_gaze_score requires a gaze session payload")
    return get_gaze_service().analyze({**gaze_session, "category": category})
