"""Schemas package initialization."""

try:
    from app.schemas.models import (
        AccuracyMetrics,
        CutoffConfig,
        AnalysisResponse,
        ForecastInterval,
        ForecastPublicationItem,
        ForecastPublicationsResponse,
        ForecastResponse,
        FuelHHRecord,
        HealthResponse,
        MetadataResponse,
        ShortfallRequest,
        ShortfallResponse,
        WindForRecord,
    )
except ImportError:
    from backend.app.schemas.models import (
        AccuracyMetrics,
        CutoffConfig,
        AnalysisResponse,
        ForecastInterval,
        ForecastPublicationItem,
        ForecastPublicationsResponse,
        ForecastResponse,
        FuelHHRecord,
        HealthResponse,
        MetadataResponse,
        ShortfallRequest,
        ShortfallResponse,
        WindForRecord,
    )

__all__ = [
    "FuelHHRecord",
    "WindForRecord",
    "ForecastInterval",
    "AccuracyMetrics",
    "CutoffConfig",
    "AnalysisResponse",
    "ForecastResponse",
    "ShortfallRequest",
    "ShortfallResponse",
    "HealthResponse",
    "MetadataResponse",
    "ForecastPublicationItem",
    "ForecastPublicationsResponse",
]
