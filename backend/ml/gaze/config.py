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

# ── Dataset coordinate frame (training only) ────────────────────────────────
# The Cilia export has no screen/stimulus-size field.  After removing the (0, 0) no-data
# placeholders, 92.5% of x fall in [0, 1024] and 95.8% of y in [0, 768] (p95: x=1071, y=735),
# so the stimulus frame is taken to be 1024x768 -- the same frame the original training
# script and gaze_lstm_metadata.json use.  This is an inference, not a documented fact.
DATASET_SCREEN_W = 1024
DATASET_SCREEN_H = 768

# ── Machine-readable error codes returned by /gaze/analyze ───────────────────
ERR_INPUT_INCOMPATIBLE = "GAZE_MODEL_INPUT_INCOMPATIBLE"
ERR_MODEL_MISSING = "GAZE_MODEL_MISSING"
ERR_MODEL_LOAD_FAILED = "GAZE_MODEL_LOAD_FAILED"
ERR_PREPROCESS_MISMATCH = "GAZE_PREPROCESSING_VERSION_MISMATCH"
ERR_INFERENCE_FAILED = "GAZE_INFERENCE_FAILED"
ERR_CATEGORY = "GAZE_CATEGORY_NOT_SUPPORTED"
ERR_QUALITY = "GAZE_SESSION_QUALITY_INSUFFICIENT"

# ── Session quality gate (applied before any model call) ─────────────────────
MIN_TOTAL_SAMPLES = 100
MIN_VALID_SAMPLES = 60
MIN_VALID_RATIO = 0.60
MIN_DURATION_S = 15.0
MAX_NONMONOTONIC_RATIO = 0.05
MIN_FACE_RATIO = 0.70
MIN_CALIBRATION_SCORE = 0.30            # fatal below this (technical session quality, not clinical)
WARN_CALIBRATION_SCORE = 0.60           # warning below this
WARN_VALID_RATIO = 0.80
WARN_GAP_RATIO = 0.10                   # share of session time inside gaps > MAX_GAP_MS
WARN_MIN_FIXATION_RATIO = 0.05
MAX_SESSION_S = 120.0

# A model whose participant-level cross-validated AUC is below this is still run and shown
# (research signal) but is NOT allowed to move the final fusion probability.
MIN_FUSION_CV_AUC = 0.70

SUPPORTED_CATEGORIES = frozenset({"child"})   # model was trained on children (2-13 y)

# Bump on ANY change that alters the tensor fed to the model; checkpoints record the version
# they were trained with and the service refuses a mismatch.
#   2.0.0  exact (0, 0) points are the eye tracker's "no data/blink" placeholder (21% of the
#          Cilia rows, 95% of them Blink) and are rejected instead of treated as top-left gaze.
GAZE_PREPROCESSING_VERSION = "2.0.0"
PREPROCESS_VERSION = GAZE_PREPROCESSING_VERSION


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
