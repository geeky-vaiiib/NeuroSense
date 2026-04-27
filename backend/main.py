"""
main.py — NeuroSense FastAPI application.

Startup:
  uvicorn main:app --reload --port 8000

Features:
  - CORS enabled for Vite dev server (localhost:5173)
  - Lifespan context manager loads ML model once at startup
  - Health check at GET /
  - Router includes: /screening, /cases, /explain
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import screening, cases, explainability
from ml.model import load_model
from schemas.screening import HealthResponse


# ── Lifespan: load model once at startup ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the ML model into app.state on startup, clean up on shutdown."""
    print("[NeuroSense] Starting up — loading model...")
    app.state.model_bundle = load_model()
    yield
    print("[NeuroSense] Shutting down — releasing resources.")
    app.state.model_bundle = None


# ── App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroSense API",
    description="ASD Screening & Explainable AI Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:4173",   # Vite preview
        "http://localhost:3000",   # fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────
app.include_router(screening.router)
app.include_router(cases.router)
app.include_router(explainability.router)


# ── Health check ────────────────────────────────────────────────────
@app.get("/", response_model=HealthResponse, tags=["Health"])
async def health():
    """Root health check — verifies the API is running and model is loaded."""
    model_loaded = (
        hasattr(app.state, "model_bundle")
        and app.state.model_bundle is not None
        and app.state.model_bundle.get("model") is not None
    )
    return HealthResponse(
        status="ok",
        modelLoaded=model_loaded,
        version="1.0.0",
    )
