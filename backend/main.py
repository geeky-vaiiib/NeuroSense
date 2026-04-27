"""NeuroSense FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .ml.model import load_models
    from .routers import cases, explainability, screening
    from .schemas.screening import HealthResponse
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.model import load_models
    from routers import cases, explainability, screening
    from schemas.screening import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all category models at startup."""
    print("[NeuroSense] Starting up — loading category-aware model registry...")
    app.state.model_registry = load_models()
    yield
    print("[NeuroSense] Shutting down.")
    app.state.model_registry = None


app = FastAPI(
    title="NeuroSense API",
    description="Dual-Category ASD Screening & Explainable AI Backend (Adult + Child)",
    version="2.0.0",
    lifespan=lifespan,
)

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
    """Health check — reports per-category model status."""
    registry = getattr(app.state, "model_registry", None) or {}
    models_loaded = {}
    for cat, bundle in registry.items():
        models_loaded[cat] = bundle.get("model") is not None
    return HealthResponse(
        status="ok",
        modelsLoaded=models_loaded,
        version="2.0.0",
    )
