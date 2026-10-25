"""Pydantic data schemas for WindSight API and domain models."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

try:
    from pydantic import BaseModel, Field

    class WindSightBaseModel(BaseModel):
        """Base model with common configuration."""

        class Config:
            populate_by_name = True
            from_attributes = True

except ImportError:
    class WindSightBaseModel:  # type: ignore[no-redef]
        """Fallback base model when pydantic is not installed."""

        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, v)

        def model_dump(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
            res = {}
            for k, v in self.__dict__.items():
                if not k.startswith("_"):
                    if hasattr(v, "model_dump"):
                        res[k] = v.model_dump()
                    elif isinstance(v, list):
                        res[k] = [item.model_dump() if hasattr(item, "model_dump") else item for item in v]
                    else:
                        res[k] = v
            return res

        dict = model_dump

        @classmethod
        def model_validate(cls, obj: Any) -> "WindSightBaseModel":
            if isinstance(obj, dict):
                return cls(**obj)
            return obj


class FuelHHRecord(WindSightBaseModel):
    """Raw half-hourly fuel generation record from Elexon FUELHH endpoint."""

    dataset: str = "FUELHH"
    publishTime: Union[datetime, str]
    startTime: Union[datetime, str]
    settlementDate: str
    settlementPeriod: int
    fuelType: str
    generation: Union[float, int]


class WindForRecord(WindSightBaseModel):
    """Raw wind generation forecast record from Elexon WINDFOR endpoint."""

    dataset: str = "WINDFOR"
    publishTime: Union[datetime, str]
    startTime: Union[datetime, str]
    generation: Union[float, int]


class ForecastInterval(WindSightBaseModel):
    """Matched hourly interval comparing wind forecast against actual generation."""

    startTime: Union[datetime, str]
    forecastGeneration: Optional[float] = None
    actualGeneration: Optional[float] = None
    publishTime: Optional[Union[datetime, str]] = None
    signedError: Optional[float] = None
    absoluteError: Optional[float] = None
    forecastEligible: bool = True


class AccuracyMetrics(WindSightBaseModel):
    """Statistical accuracy metrics evaluating wind forecast performance."""

    mae: Optional[float] = None
    rmse: Optional[float] = None
    bias: Optional[float] = None
    mape: Optional[float] = None
    count: int = 0
    coverage: float = 0.0
    overpredictionPct: Optional[float] = None
    underpredictionPct: Optional[float] = None


class CutoffConfig(WindSightBaseModel):
    """Configured day-ahead cutoff, expressed in UTC."""

    hour: int
    minute: int
    timezone: str = "UTC"
    date: Optional[str] = None


class AnalysisResponse(WindSightBaseModel):
    """Response payload for multi-day forecast accuracy analysis."""

    metrics: AccuracyMetrics
    intervals: List[ForecastInterval]
    period: Dict[str, str]
    cutoff: CutoffConfig
    dataFreshness: str


class ForecastResponse(WindSightBaseModel):
    """Response payload for single-day forecast queries."""

    date: str
    cutoff: CutoffConfig
    intervals: List[ForecastInterval]
    summary: Optional[AccuracyMetrics] = None


class ShortfallRequest(WindSightBaseModel):
    """Request payload to calculate potential grid generation shortfall."""

    demand_mw: float
    forecast_mw: float


class ShortfallResponse(WindSightBaseModel):
    """Response payload detailing calculated shortfall and contextual disclaimer."""

    demand_mw: float
    forecast_mw: float
    shortfall_mw: float
    disclaimer: str


class HealthResponse(WindSightBaseModel):
    """Health check response schema."""

    status: str = "ok"
    version: str = "1.0.0"
    timestamp: str


class MetadataResponse(WindSightBaseModel):
    """Metadata response describing conventions, data sources, and cutoff rules."""

    elexon_base_url: str
    default_cutoff: str
    market_convention: str
    temporal_alignment_method: str
    supported_datasets: List[str]
    notes: List[str]


class ForecastPublicationItem(WindSightBaseModel):
    """Individual forecast publication revision for an interval."""

    publishTime: Union[datetime, str]
    startTime: Union[datetime, str]
    generation: Optional[float] = None
    forecastGeneration: Optional[float] = None
    dataset: str = "WINDFOR"
    eligibleBeforeCutoff: Optional[bool] = None


class ForecastPublicationsResponse(WindSightBaseModel):
    """Response containing publication history for a specific interval."""

    date: str
    startTime: str
    cutoff: str
    publications: List[ForecastPublicationItem]
