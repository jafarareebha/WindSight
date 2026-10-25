"""API endpoints for WindSight wind forecast and actuals analysis."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Callable, Dict, List, Optional
from dateutil import parser as dt_parser

try:
    from app.core.config import settings
    from app.schemas.models import (
        AccuracyMetrics,
        CutoffConfig,
        AnalysisResponse,
        ForecastInterval,
        ForecastPublicationItem,
        ForecastPublicationsResponse,
        ForecastResponse,
        HealthResponse,
        MetadataResponse,
        ShortfallRequest,
        ShortfallResponse,
    )
    from app.services.accuracy_calculator import AccuracyCalculator
    from app.services.data_processor import DataProcessor
    from app.services.elexon_client import ElexonAPIError, ElexonClient
except ImportError:
    from backend.app.core.config import settings
    from backend.app.schemas.models import (
        AccuracyMetrics,
        CutoffConfig,
        AnalysisResponse,
        ForecastInterval,
        ForecastPublicationItem,
        ForecastPublicationsResponse,
        ForecastResponse,
        HealthResponse,
        MetadataResponse,
        ShortfallRequest,
        ShortfallResponse,
    )
    from backend.app.services.accuracy_calculator import AccuracyCalculator
    from backend.app.services.data_processor import DataProcessor
    from backend.app.services.elexon_client import ElexonAPIError, ElexonClient

logger = logging.getLogger(__name__)

# FastAPI or Fallback Router Definition
try:
    from fastapi import APIRouter, Depends, HTTPException, Query, status
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

    class HTTPException(Exception):  # type: ignore[no-redef]
        def __init__(self, status_code: int, detail: str) -> None:
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    def Query(default: Any = ..., **kwargs: Any) -> Any:  # type: ignore[no-redef]
        return default if default is not ... else None

    def Depends(dependency: Any) -> Any:  # type: ignore[no-redef]
        return dependency

    class APIRouter:  # type: ignore[no-redef]
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.routes: List[Dict[str, Any]] = []

        def get(self, path: str, **kwargs: Any) -> Callable:
            def decorator(func: Callable) -> Callable:
                self.routes.append({"method": "GET", "path": path, "func": func, **kwargs})
                return func
            return decorator

        def post(self, path: str, **kwargs: Any) -> Callable:
            def decorator(func: Callable) -> Callable:
                self.routes.append({"method": "POST", "path": path, "func": func, **kwargs})
                return func
            return decorator


router = APIRouter(prefix="/api", tags=["WindSight"])

# Singleton dependency instances
_elexon_client_instance = ElexonClient()
_data_processor_instance = DataProcessor()
_accuracy_calculator_instance = AccuracyCalculator()


def get_elexon_client() -> ElexonClient:
    """Dependency provider for ElexonClient."""
    return _elexon_client_instance


def get_data_processor() -> DataProcessor:
    """Dependency provider for DataProcessor."""
    return _data_processor_instance


def get_accuracy_calculator() -> AccuracyCalculator:
    """Dependency provider for AccuracyCalculator."""
    return _accuracy_calculator_instance


def _parse_date(date_str: str) -> datetime:
    """Validate and parse date string in YYYY-MM-DD format."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format '{date_str}'. Expected YYYY-MM-DD (e.g. 2026-01-01).",
        )


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint to verify service liveness."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.get("/metadata", response_model=MetadataResponse)
async def get_metadata() -> MetadataResponse:
    """Metadata describing Elexon datasets, day-ahead conventions, and alignment strategy."""
    return MetadataResponse(
        elexon_base_url=settings.ELEXON_BASE_URL,
        default_cutoff=f"{settings.DEFAULT_CUTOFF_HOUR:02d}:{settings.DEFAULT_CUTOFF_MINUTE:02d} UTC (Day D-1)",
        market_convention="EPEX SPOT UK Day-Ahead Auction Gate Closure (09:30 GMT / UTC in January)",
        temporal_alignment_method="Native 30-minute settlement period resolution: each FUELHH half-hour actual is compared against the prevailing WINDFOR hourly forecast",
        supported_datasets=["FUELHH", "WINDFOR"],
        notes=[
            "WINDFOR provides hourly forecasted national wind generation across multiple publish times.",
            "FUELHH provides half-hourly actual outturn generation per fuel type. Filtered to fuelType == 'WIND'.",
            "Day-ahead forecasts are selected as the latest forecast published on or before 09:30 UTC on day D-1.",
            "Each 30-minute settlement period is evaluated directly at its native resolution against the applicable forecast.",
            "Signed error is defined as (Forecast - Actual) in MW; positive values represent overestimation.",
        ],
    )


@router.get("/forecasts", response_model=ForecastResponse)
async def get_forecasts(
    date: str = Query(..., description="Target delivery date in YYYY-MM-DD format (e.g. 2026-01-15)"),
    cutoff_hour: int = Query(settings.DEFAULT_CUTOFF_HOUR, description="Cutoff hour UTC (0-23)"),
    cutoff_minute: int = Query(settings.DEFAULT_CUTOFF_MINUTE, description="Cutoff minute UTC (0-59)"),
    elexon_client: ElexonClient = Depends(get_elexon_client),
    processor: DataProcessor = Depends(get_data_processor),
    calculator: AccuracyCalculator = Depends(get_accuracy_calculator),
) -> ForecastResponse:
    """Retrieve wind forecasts and matched actuals for a specific delivery date."""
    target_dt = _parse_date(date)

    # Cutoff for delivery day D is day D-1 at cutoff_hour:cutoff_minute
    day_ahead_cutoff_date = target_dt - timedelta(days=1)

    # WINDFOR fetch window: from D-2 to D+1 to capture all publications
    fc_start = (target_dt - timedelta(days=2)).strftime("%Y-%m-%dT00:00:00Z")
    fc_end = (target_dt + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")

    # FUELHH fetch window: from D 00:00:00 to D+1 04:00:00 to capture period 48 published next morning
    act_start = target_dt.strftime("%Y-%m-%dT00:00:00Z")
    act_end = (target_dt + timedelta(days=1, hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        raw_forecasts = await elexon_client.fetch_windfor(fc_start, fc_end)
        raw_actuals = await elexon_client.fetch_fuelhh(act_start, act_end)
    except ElexonAPIError as e:
        logger.error("Error communicating with Elexon API: %s", str(e))
        raise HTTPException(
            status_code=e.status_code or 502,
            detail=f"Elexon upstream error: {e.message}",
        )

    # Match intervals
    all_intervals = processor.match_forecast_actual_pairs(
        forecasts=raw_forecasts,
        actuals=raw_actuals,
        cutoff_hour=cutoff_hour,
        cutoff_minute=cutoff_minute,
    )

    # Filter to only the requested date's 24 hours
    date_prefix = target_dt.strftime("%Y-%m-%d")
    day_intervals = [
        inv for inv in all_intervals
        if str(inv.startTime).startswith(date_prefix)
    ]

    # Calculate summary metrics for the day
    summary = calculator.calculate_metrics(day_intervals, total_expected=48)

    return ForecastResponse(
        date=date,
        cutoff=CutoffConfig(
            hour=cutoff_hour,
            minute=cutoff_minute,
            timezone="UTC",
            date=day_ahead_cutoff_date.strftime("%Y-%m-%d"),
        ),
        intervals=day_intervals,
        summary=summary,
    )


@router.get("/actuals")
async def get_actuals(
    date: str = Query(..., description="Target delivery date in YYYY-MM-DD format (e.g. 2026-01-15)"),
    elexon_client: ElexonClient = Depends(get_elexon_client),
    processor: DataProcessor = Depends(get_data_processor),
) -> Dict[str, Any]:
    """Retrieve actual wind generation records (both 30-min settlement and hourly averaged)."""
    target_dt = _parse_date(date)
    act_start = target_dt.strftime("%Y-%m-%dT00:00:00Z")
    act_end = (target_dt + timedelta(days=1, hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        raw_actuals = await elexon_client.fetch_fuelhh(act_start, act_end)
    except ElexonAPIError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=e.message)

    wind_actuals = processor.filter_wind_actuals(raw_actuals)
    clean_actuals = processor.deduplicate_actuals(wind_actuals)

    # Filter strictly to the requested settlementDate or startTime date
    date_prefix = target_dt.strftime("%Y-%m-%d")
    day_actuals = [
        a for a in clean_actuals
        if str(a.get("settlementDate", "")).startswith(date_prefix) or str(a.get("startTime", "")).startswith(date_prefix)
    ]

    return {
        "date": date,
        "fuelType": "WIND",
        "countHalfHourly": len(day_actuals),
        "actuals": day_actuals,
    }


@router.get("/analysis", response_model=AnalysisResponse)
async def get_analysis(
    start_date: str = Query(settings.ANALYSIS_START_DATE, description="Start date YYYY-MM-DD"),
    end_date: str = Query(settings.ANALYSIS_END_DATE, description="End date YYYY-MM-DD"),
    cutoff_hour: int = Query(settings.DEFAULT_CUTOFF_HOUR, description="Cutoff hour UTC (0-23)"),
    cutoff_minute: int = Query(settings.DEFAULT_CUTOFF_MINUTE, description="Cutoff minute UTC (0-59)"),
    elexon_client: ElexonClient = Depends(get_elexon_client),
    processor: DataProcessor = Depends(get_data_processor),
    calculator: AccuracyCalculator = Depends(get_accuracy_calculator),
) -> AnalysisResponse:
    """Analyze forecast accuracy over an extended date range (e.g. January 2026)."""
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")

    # Fetch WINDFOR from (start_date - 2 days) to (end_date + 1 day)
    fc_start = (start_dt - timedelta(days=2)).strftime("%Y-%m-%dT00:00:00Z")
    fc_end = (end_dt + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")

    # Fetch FUELHH from start_date to (end_date + 1 day 04:00:00)
    act_start = start_dt.strftime("%Y-%m-%dT00:00:00Z")
    act_end = (end_dt + timedelta(days=1, hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        raw_forecasts = await elexon_client.fetch_windfor(fc_start, fc_end)
        raw_actuals = await elexon_client.fetch_fuelhh(act_start, act_end)
    except ElexonAPIError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=e.message)

    matched = processor.match_forecast_actual_pairs(
        forecasts=raw_forecasts,
        actuals=raw_actuals,
        cutoff_hour=cutoff_hour,
        cutoff_minute=cutoff_minute,
    )

    # Filter matched intervals to range [start_dt, end_dt 23:59:59]
    range_intervals: List[ForecastInterval] = []
    for inv in matched:
        inv_dt = processor._to_utc_datetime(inv.startTime)
        if start_dt <= inv_dt <= (end_dt + timedelta(hours=23, minutes=59)):
            range_intervals.append(inv)

    total_days = (end_dt - start_dt).days + 1
    total_expected_intervals = total_days * 48

    metrics = calculator.calculate_metrics(range_intervals, total_expected=total_expected_intervals)

    return AnalysisResponse(
        metrics=metrics,
        intervals=range_intervals,
        period={
            "start": start_date,
            "end": end_date,
            "startDate": start_date,
            "endDate": end_date,
        },
        cutoff=CutoffConfig(
            hour=cutoff_hour,
            minute=cutoff_minute,
            timezone="UTC",
            date=(start_dt - timedelta(days=1)).strftime("%Y-%m-%d"),
        ),
        dataFreshness=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.get("/forecast-publications", response_model=ForecastPublicationsResponse)
async def get_forecast_publications(
    date: str = Query(..., description="Delivery date YYYY-MM-DD"),
    start_time: str = Query(..., description="Delivery start time ISO 8601 (e.g. 2026-01-15T12:00:00Z)"),
    cutoff_hour: int = Query(settings.DEFAULT_CUTOFF_HOUR, description="Cutoff hour UTC (0-23)"),
    cutoff_minute: int = Query(settings.DEFAULT_CUTOFF_MINUTE, description="Cutoff minute UTC (0-59)"),
    elexon_client: ElexonClient = Depends(get_elexon_client),
    processor: DataProcessor = Depends(get_data_processor),
) -> ForecastPublicationsResponse:
    """Inspect all revision publications for a specific delivery interval to observe forecast evolution."""
    target_dt = _parse_date(date)
    interval_dt = processor._to_utc_datetime(start_time)
    forecast_hour_dt = interval_dt.replace(minute=0, second=0, microsecond=0)

    # Cutoff is (delivery_day - 1 day) at cutoff_hour:cutoff_minute
    cutoff_dt = datetime(
        year=target_dt.year,
        month=target_dt.month,
        day=target_dt.day,
        hour=cutoff_hour,
        minute=cutoff_minute,
        tzinfo=timezone.utc,
    ) - timedelta(days=1)

    # Query WINDFOR across a wide window
    fc_start = (target_dt - timedelta(days=3)).strftime("%Y-%m-%dT00:00:00Z")
    fc_end = (target_dt + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")

    try:
        raw_forecasts = await elexon_client.fetch_windfor(fc_start, fc_end)
    except ElexonAPIError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=e.message)

    # Filter to this specific delivery interval's forecast hour
    matching_pubs: List[ForecastPublicationItem] = []
    clean_fc = processor.deduplicate_forecasts(raw_forecasts)

    for fc in clean_fc:
        fc_start_dt = processor._to_utc_datetime(fc["startTime"])
        if fc_start_dt == forecast_hour_dt:
            pub_dt = processor._to_utc_datetime(fc["publishTime"])
            is_eligible = pub_dt <= cutoff_dt
            raw_gen = fc.get("generation")
            gen_val = float(raw_gen) if raw_gen is not None else None
            matching_pubs.append(
                ForecastPublicationItem(
                    publishTime=pub_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    startTime=interval_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    generation=gen_val,
                    forecastGeneration=gen_val,
                    dataset="WINDFOR",
                    eligibleBeforeCutoff=is_eligible,
                )
            )

    matching_pubs.sort(key=lambda x: processor._to_utc_datetime(x.publishTime))

    return ForecastPublicationsResponse(
        date=date,
        startTime=interval_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        cutoff=cutoff_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        publications=matching_pubs,
    )


@router.post("/shortfall", response_model=ShortfallResponse)
async def calculate_shortfall(request: ShortfallRequest) -> ShortfallResponse:
    """Calculate potential generation shortfall (gap between demand and forecasted wind generation)."""
    if request.demand_mw < 0:
        raise HTTPException(status_code=400, detail="demand_mw must be greater than or equal to 0.")
    if request.forecast_mw < 0:
        raise HTTPException(status_code=400, detail="forecast_mw must be greater than or equal to 0.")

    shortfall = max(0.0, round(request.demand_mw - request.forecast_mw, 2))

    disclaimer = (
        "Shortfall represents the net generation gap (Demand - Wind Forecast) in MW. "
        "In the UK electricity system, this residual demand is balanced by dispatchable "
        "thermal generation (CCGT, biomass, nuclear), interconnectors, and energy storage assets. "
        "Wind generation alone is not expected to satisfy 100% of national electricity demand."
    )

    return ShortfallResponse(
        demand_mw=request.demand_mw,
        forecast_mw=request.forecast_mw,
        shortfall_mw=shortfall,
        disclaimer=disclaimer,
    )
