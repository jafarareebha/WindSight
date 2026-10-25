"""FastAPI main application entry point for WindSight."""

import logging
from typing import Any, List

try:
    from app.api.routes import router
    from app.core.config import settings
except ImportError:
    from backend.app.api.routes import router
    from backend.app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("windsight")

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import RedirectResponse
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    FastAPI = None  # type: ignore
    CORSMiddleware = None  # type: ignore


def create_app() -> Any:
    """Create and configure the FastAPI application instance."""
    if not HAS_FASTAPI:
        logger.warning("FastAPI is not installed; returning placeholder app instance.")
        return None

    app = FastAPI(
        title="WindSight API",
        description=(
            "Production backend for WindSight: UK Wind Power Day-Ahead Forecast Accuracy "
            "and Grid Shortfall Analysis Engine (Elexon BMRS API integration)."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS configuration
    origins = settings.CORS_ORIGINS
    if isinstance(origins, str):
        origins = [orig.strip() for orig in origins.split(",")]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routes
    app.include_router(router)

    @app.get("/", include_in_schema=False)
    async def root_redirect():
        """Redirect root requests directly to Swagger UI documentation."""
        return RedirectResponse(url="/docs")

    return app


app = create_app()

if __name__ == "__main__":
    try:
        import uvicorn
        uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
    except ImportError:
        print("uvicorn is not installed. Run 'pip install -r requirements.txt' to start the server.")
