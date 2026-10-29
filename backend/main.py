"""NeuroSense FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager

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
    from core import database
    from ml.gaze.service import get_gaze_service
    from ml.model import load_models
    from core.config import get_settings
    from routers import auth, cases, explainability, gaze, screening
    from schemas.screening import HealthResponse

logger = logging.getLogger("neurosense")

APP_VERSION = "3.2.0"      # single source for the OpenAPI document and GET /


# ── Body size limiter ───────────────────────────────────────────────────────
class LimitBodySizeMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds a configurable limit.

    Default: 10 MB — enough for ~20s base64 audio (≈1 MB) plus gaze data.
    """

    # Recording uploads are much larger than JSON requests; that route enforces its own limit while streaming.
    PER_PATH_LIMITS = {"/gaze/analyze": 160 * 1024 * 1024}

    def __init__(self, app, max_body_size: int = 10 * 1024 * 1024):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        limit = self.PER_PATH_LIMITS.get(request.url.path, self.max_body_size)
        if content_length and int(content_length) > limit:
            max_mb = limit // (1024 * 1024)
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

    # Startup report: what actually exists, no claims about optional components
    for cat, bundle in (app.state.model_registry or {}).items():
        logger.info("Questionnaire ML model [%s]: %s (explanation-only; the result is the score rule)", cat,
                    "loaded" if bundle.get("model") is not None else "NOT loaded")
    _gaze = get_gaze_service().status()
    logger.info("Gaze: model %s, OpenFace %s - experimental, excluded from the result",
                _gaze["model_version"] if _gaze["available"] else f"UNAVAILABLE ({_gaze['detail']})",
                "available" if _gaze["openface_available"] else "NOT installed")
    try:
        from .ml import toddler_service as _ts
    except ImportError:  # pragma: no cover
        from ml import toddler_service as _ts
    _t = _ts.model_status()
    logger.info("Toddler Q-CHAT-10: official score drives the result; cohort model %s",
                _t["model_version"] if _t["available"] else f"UNAVAILABLE ({_t['reason']})")
    logger.info("Speech: acoustic measurement only; classifier %s", "loaded" if _speech_classifier()[0] else "unavailable (none installed)")
    logger.info("Facial: face detection only; no ASD classifier exists")

    # ── MongoDB Atlas ────────────────────────────────────────────────
    database.init_db()

    # Prime OpenFace in the background (first run is much slower than later runs); never blocks startup.
    import threading
    try:
        from .ml.gaze import openface as _of
    except ImportError:  # pragma: no cover
        from ml.gaze import openface as _of
    threading.Thread(target=lambda: logger.info("OpenFace warm-up: %s s", _of.warmup()), daemon=True).start()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("[NeuroSense] Shutting down.")
    app.state.model_registry = None
    database.close_db()


# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroSense API",
    description=(
        "ASD screening aid: server-scored questionnaire with experimental gaze/speech/facial measurements. Not a diagnostic tool."
    ),
    version=APP_VERSION,
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


def _speech_classifier():
    try:
        from .ml import speech_engine as _se
    except ImportError:  # pragma: no cover
        from ml import speech_engine as _se
    return _se.load_classifier()


def _toddler_status() -> dict:
    try:
        from .ml import toddler_service as _ts
    except ImportError:  # pragma: no cover
        from ml import toddler_service as _ts
    st = _ts.model_status()
    return {"model_available": st["available"], "model_version": st.get("model_version"), "reason": st.get("reason"),
            "clinically_validated": False}


def _db_status() -> dict:
    try:
        database.get_db().command("ping")
        return {"connected": True}
    except Exception:
        return {"connected": False}          # no connection string / error text is exposed


@app.get("/", response_model=HealthResponse, tags=["Health"])
async def health():
    """Health and capability report built from the real state of each component (no secrets)."""
    try:
        from .ml.fusion_engine import FORMULA
    except ImportError:  # pragma: no cover
        from ml.fusion_engine import FORMULA
    registry = getattr(app.state, "model_registry", None) or {}
    models_loaded = {cat: bundle.get("model") is not None for cat, bundle in registry.items()}
    gaze = get_gaze_service().status()
    speech_clf, speech_why = _speech_classifier()
    db = _db_status()
    return HealthResponse(
        status="ok" if db["connected"] else "degraded",
        modelsLoaded=models_loaded,
        modalities={
            "toddler_questionnaire": {**_toddler_status(), "instrument": "Q-CHAT-10 (official score drives the result)"},
            "questionnaire": {"status": "available_scoring_instrument", "result_driver": True,
                              "ml_model_loaded": models_loaded, "ml_model_role": "models the scoring rule; explanation only",
                              "clinically_validated": False},
            "gaze": {"status": "available_experimental" if gaze["available"] else "model_unavailable",
                     "model_version": gaze["model_version"], "openface_available": gaze["openface_available"],
                     "in_result": False, "detail": gaze["detail"]},
            "speech": {"status": "available_experimental" if speech_clf else "model_unavailable",
                       "classifier_loaded": bool(speech_clf), "in_result": False, "reason": speech_why},
            "facial": {"status": "model_unavailable", "capabilities": ["face_detection", "image_quality"],
                       "classifier_loaded": False, "in_result": False},
            "result": {"basis": "questionnaire_score_only", "formula": FORMULA},
        },
        database=db,
        version=APP_VERSION,
    )
