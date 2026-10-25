"""API package initialization."""

try:
    from app.api.routes import router
except ImportError:
    from backend.app.api.routes import router

__all__ = ["router"]
