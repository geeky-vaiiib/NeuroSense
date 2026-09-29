"""Single source of truth for the gaze pipeline.

Training (backend/data/train_gaze_browser.py) and serving (gaze_model_service.py)
both import these constants and ``preprocess.py``.  The values that affect the
model input are snapshotted into the checkpoint (``preprocess_config``) and the
service refuses to run a checkpoint whose snapshot differs from this module.

Feature provenance (browser stack: WebGazer + MediaPipe FaceMesh)
------------------------------------------------------------------
  x, y          measured   WebGazer point-of-regard, viewport px -> [0, 1]
  timestamp     measured   performance.now() ms (monotonic)
  face_detected measured   WebGazer returned a prediction for the frame
  stimulus_id   measured   the app knows which stimulus it is showing
  dt            derived    from timestamps on the server (client value ignored)
  is_fixation   derived    I-DT dispersion rule below (no device fixation label)
  speed         derived    finite difference of resampled x, y
  pupil         UNAVAILABLE  not exposed by WebGazer / FaceMesh -> never sent, never
                             invented; models that require it are refused.
  confidence    UNAVAILABLE  WebGazer exposes no per-prediction confidence.
"""

from __future__ import annotations

# ── Model input contract ─────────────────────────────────────────────────────
FEATURE_NAMES: tuple[str, ...] = ("x", "y", "speed", "is_fixation")
BROWSER_AVAILABLE_FEATURES: frozenset[str] = frozenset(FEATURE_NAMES)

SEQ_LEN = 300              # resampled steps per sequence (30 s at RESAMPLE_HZ)
MIN_SEQ_STEPS = 150        # shortest sequence used in training (15 s)
RESAMPLE_HZ = 10
STEP_MS = 1000 // RESAMPLE_HZ

# ── Sample validity rules ────────────────────────────────────────────────────
MAX_GAP_MS = 500           # gap > this between valid samples breaks a segment
MAX_ABS_COORD_PX = 1e5     # sanity bound before comparing with the screen
MIN_SCREEN_PX = 200
MAX_SCREEN_PX = 10000

# ── Fixation rule (I-DT, dispersion-threshold identification) ────────────────
# Coordinates are normalised to [0, 1]; dispersion = (max_x-min_x)+(max_y-min_y).
FIXATION_DISPERSION = 0.08
FIXATION_MIN_MS = 100

# ── Dataset screen (training only) ───────────────────────────────────────────
# Cilia et al. export has no screen-size field.  This is a lower bound inferred
# from the largest observed point-of-regard (x<=1407.2, y<=1126.3).
DATASET_SCREEN_W = 1408
DATASET_SCREEN_H = 1127

# ── Session quality gate (applied before any model call) ─────────────────────
MIN_TOTAL_SAMPLES = 100
MIN_VALID_SAMPLES = 60
MIN_VALID_RATIO = 0.60
MIN_DURATION_S = 15.0
MAX_NONMONOTONIC_RATIO = 0.05
MIN_FACE_RATIO = 0.70
MIN_CALIBRATION_SCORE = 0.40
MAX_SESSION_S = 120.0

SUPPORTED_CATEGORIES = frozenset({"child"})   # model was trained on children (2-13 y)

PREPROCESS_VERSION = "gaze-pre-1"


def preprocess_config() -> dict:
    """Snapshot of every setting that changes the tensor fed to the model."""
    return {
        "version": PREPROCESS_VERSION,
        "feature_names": list(FEATURE_NAMES),
        "seq_len": SEQ_LEN,
        "min_seq_steps": MIN_SEQ_STEPS,
        "resample_hz": RESAMPLE_HZ,
        "max_gap_ms": MAX_GAP_MS,
        "fixation_dispersion": FIXATION_DISPERSION,
        "fixation_min_ms": FIXATION_MIN_MS,
    }
