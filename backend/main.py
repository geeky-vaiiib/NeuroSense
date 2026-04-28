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
    from .ml.model import load_models
    from .routers import cases, explainability, screening
    from .schemas.screening import HealthResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.model import load_models
    from routers import cases, explainability, screening
    from schemas.screening import HealthResponse

logger = logging.getLogger("neurosense")

# ── Model checkpoint paths ──────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_GAZE_LSTM_PATH = _MODELS_DIR / "gaze_lstm.pt"
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
    """Load all category models at startup."""
    logger.info("[NeuroSense] Starting up — loading category-aware model registry...")
    app.state.model_registry = load_models()

    # Report modality engine status
    logger.info(
        "Modality engines: Questionnaire ✓ | Gaze (heuristic) ✓ | "
        "Speech (heuristic) ✓ | Facial ✗"
    )
    logger.info(
        "LSTM gaze model: %s",
        "LOADED" if _GAZE_LSTM_PATH.exists() else "NOT FOUND — using heuristic",
    )
    logger.info(
        "Speech CNN model: %s",
        "LOADED" if _SPEECH_CNN_PATH.exists() else "NOT FOUND — using heuristic",
    )

    yield

    logger.info("[NeuroSense] Shutting down.")
    app.state.model_registry = None


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
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            "gaze": True,
            "speech": True,
            "facial": False,
            "gaze_lstm": _GAZE_LSTM_PATH.exists(),
            "speech_cnn": _SPEECH_CNN_PATH.exists(),
        },
        version="3.0.0",
    )
