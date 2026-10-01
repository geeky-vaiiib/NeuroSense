"""NeuroSense FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

try:
    from .core import database
    from .ml.gaze.service import get_gaze_service
    from .ml.model import load_models
    from .core.config import get_settings
    from .routers import auth, cases, explainability, gaze, screening
    from .schemas.screening import HealthResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from .core import database
    from ml.gaze.service import get_gaze_service
    from ml.model import load_models
    from core.config import get_settings
    from routers import auth, cases, explainability, gaze, screening
    from schemas.screening import HealthResponse

logger = logging.getLogger("neurosense")

# ── Model checkpoint paths ──────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_SPEECH_CNN_PATH = _MODELS_DIR / "speech_cnn.pt"


# ── Body size limiter ───────────────────────────────────────────────────────
class LimitBodySizeMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds a configurable limit.

    Default: 10 MB — enough for ~20s base64 audio (≈1 MB) plus gaze data.
    """

    def __init__(self, app, max_body_size: int = 10 * 1024 * 1024):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_body_size:
            max_mb = self.max_body_size // (1024 * 1024)
            return JSONResponse(
                status_code=413,
                content={
                    "detail": (
                        f"Request body too large. "
                        f"Maximum size: {max_mb}MB"
                    )
                },
            )
        return await call_next(request)


# ── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models and initialise MongoDB at startup; close both on shutdown."""
    get_settings()   # fail fast with a clear message if security config is missing
    logger.info("[NeuroSense] Starting up — loading category-aware model registry...")
    app.state.model_registry = load_models()

    # Report modality engine status with honest method labels
    logger.info(
        "Modality engines loaded:\n"
        "  Questionnaire  → TRAINED ML CLASSIFIER (supervised — UCI/Kaggle labeled data) ✓\n"
        "  Gaze           → TRAINED BiLSTM on DASD/OpenFace features (OpenFace on the server) — see /gaze/status\n"
        "  Speech         → RULE-BASED HEURISTIC (Bone et al. 2014 — no labeled training data) ✓\n"
        "  Facial         → NOT IMPLEMENTED ✗\n"
        "  Fusion         → fusion_engine.fuse() — Option A (P(Q) drives risk level) ✓"
    )
    _gaze = get_gaze_service().status()
    logger.info("Gaze model: %s (OpenFace available: %s)",
                _gaze["model_version"] if _gaze["available"] else f"UNAVAILABLE ({_gaze['detail']})",
                _gaze["openface_available"])
    logger.info(
        "Speech CNN model: %s",
        "LOADED — is_trained_model=True" if _SPEECH_CNN_PATH.exists()
        else "NOT FOUND — rule_based_heuristic active (is_trained_model=False)",
    )

    # ── MongoDB Atlas ────────────────────────────────────────────────
    database.init_db()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("[NeuroSense] Shutting down.")
    app.state.model_registry = None
    database.close_db()


# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroSense API",
    description=(
        "Multimodal ASD Screening & Explainable AI Backend "
        "(Adult + Child + Toddler — Questionnaire, Gaze, Speech)"
    ),
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(LimitBodySizeMiddleware, max_body_size=10 * 1024 * 1024)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins from CORS_ALLOWED_ORIGINS ("*" is rejected by config: cookies are used)
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(gaze.router)
app.include_router(screening.router)
app.include_router(cases.router)
app.include_router(explainability.router)


@app.get("/", response_model=HealthResponse, tags=["Health"])
async def health():
    """Health check — reports per-category model and modality status."""
    registry = getattr(app.state, "model_registry", None) or {}
    models_loaded = {}
    for cat, bundle in registry.items():
        models_loaded[cat] = bundle.get("model") is not None

    return HealthResponse(
        status="ok",
        modelsLoaded=models_loaded,
        modalities={
            "questionnaire": True,
            "questionnaire_method": "supervised_ml",
            "questionnaire_is_trained": True,
            "gaze": True,
            "gaze_method": "bilstm_openface_dasd" if get_gaze_service().available else None,
            "gaze_is_trained": get_gaze_service().fusion_eligibility()[0],
            "gaze_detail": get_gaze_service().health(),
            "speech": True,
            "speech_method": "cnn_trained" if _SPEECH_CNN_PATH.exists() else "rule_based_heuristic",
            "speech_is_trained": _SPEECH_CNN_PATH.exists(),
            "facial": False,
            "facial_method": None,
            "fusion_engine": "fusion_engine.fuse()",
            "fusion_strategy": "Option A — final_probability = P(Q) only",
        },
        version="3.1.0",
    )
