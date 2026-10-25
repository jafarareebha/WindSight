"""Integration and unit tests for API endpoints with mocked Elexon services."""

import asyncio
from pathlib import Path
import sys
import unittest
from typing import Any, Dict, List

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.api.routes import (
    calculate_shortfall,
    get_actuals,
    get_analysis,
    get_forecast_publications,
    get_forecasts,
    get_metadata,
    health_check,
)
from backend.app.schemas.models import ShortfallRequest
from backend.app.services.accuracy_calculator import AccuracyCalculator
from backend.app.services.data_processor import DataProcessor
from backend.app.services.elexon_client import ElexonAPIError, ElexonClient
from backend.tests.conftest import get_sample_fuelhh_raw, get_sample_windfor_raw


class MockElexonClient(ElexonClient):
    """Mock client returning deterministic Elexon API data without network calls."""

    def __init__(self, should_fail: bool = False, fail_status: int = 502) -> None:
        super().__init__()
        self.should_fail = should_fail
        self.fail_status = fail_status

    async def fetch_fuelhh(self, start_date: Any, end_date: Any) -> List[Dict[str, Any]]:
        if self.should_fail:
            raise ElexonAPIError("Simulated upstream Elexon failure", status_code=self.fail_status)
        return get_sample_fuelhh_raw()

    async def fetch_windfor(self, publish_from: Any, publish_to: Any) -> List[Dict[str, Any]]:
        if self.should_fail:
            raise ElexonAPIError("Simulated upstream Elexon failure", status_code=self.fail_status)
        return get_sample_windfor_raw()


class TestAPIEndpoints(unittest.TestCase):
    """Test suite testing all WindSight API endpoints with mocked backend services."""

    def setUp(self) -> None:
        self.mock_client = MockElexonClient()
        self.processor = DataProcessor()
        self.calculator = AccuracyCalculator()

    def test_health_endpoint(self) -> None:
        """Verify GET /api/health returns status ok."""
        res = asyncio.run(health_check())
        self.assertEqual(res.status, "ok")
        self.assertEqual(res.version, "1.0.0")
        self.assertIsNotNone(res.timestamp)

    def test_metadata_endpoint(self) -> None:
        """Verify GET /api/metadata returns dataset info and market conventions."""
        res = asyncio.run(get_metadata())
        self.assertIn("EPEX SPOT", res.market_convention)
        self.assertIn("30-minute", res.temporal_alignment_method)
        self.assertIn("FUELHH", res.supported_datasets)
        self.assertIn("WINDFOR", res.supported_datasets)

    def test_forecasts_endpoint(self) -> None:
        """Verify GET /api/forecasts retrieves and aligns day-ahead intervals."""
        res = asyncio.run(
            get_forecasts(
                date="2026-01-02",
                cutoff_hour=9,
                cutoff_minute=30,
                elexon_client=self.mock_client,
                processor=self.processor,
                calculator=self.calculator,
            )
        )
        self.assertEqual(res.date, "2026-01-02")
        self.assertGreater(len(res.intervals), 0)
        self.assertIsNotNone(res.summary)
        self.assertGreater(res.summary.count, 0)
        self.assertEqual(res.cutoff.hour, 9)
        self.assertEqual(res.cutoff.minute, 30)
        self.assertEqual(res.cutoff.timezone, "UTC")
        self.assertEqual(res.cutoff.date, "2026-01-01")
        self.assertEqual(res.summary.coverage, round(res.summary.count / 48, 4))

    def test_forecasts_invalid_date_error(self) -> None:
        """Verify GET /api/forecasts raises HTTPException 400 for bad date format."""
        with self.assertRaises(Exception) as ctx:
            asyncio.run(
                get_forecasts(
                    date="invalid-date",
                    elexon_client=self.mock_client,
                    processor=self.processor,
                    calculator=self.calculator,
                )
            )
        self.assertTrue(hasattr(ctx.exception, "status_code"))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_actuals_endpoint(self) -> None:
        """Verify GET /api/actuals returns wind generation data."""
        res = asyncio.run(
            get_actuals(
                date="2026-01-02",
                elexon_client=self.mock_client,
                processor=self.processor,
            )
        )
        self.assertEqual(res["date"], "2026-01-02")
        self.assertEqual(res["fuelType"], "WIND")
        self.assertGreater(res["countHalfHourly"], 0)

    def test_analysis_endpoint(self) -> None:
        """Verify GET /api/analysis performs date-range analysis."""
        res = asyncio.run(
            get_analysis(
                start_date="2026-01-01",
                end_date="2026-01-03",
                cutoff_hour=9,
                cutoff_minute=30,
                elexon_client=self.mock_client,
                processor=self.processor,
                calculator=self.calculator,
            )
        )
        self.assertEqual(res.period["startDate"], "2026-01-01")
        self.assertEqual(res.period["endDate"], "2026-01-03")
        self.assertIsNotNone(res.metrics)
        self.assertIsNotNone(res.dataFreshness)
        self.assertEqual(res.metrics.coverage, round(res.metrics.count / 144, 4))

    def test_forecast_publications_endpoint(self) -> None:
        """Verify GET /api/forecast-publications returns publication history."""
        res = asyncio.run(
            get_forecast_publications(
                date="2026-01-02",
                start_time="2026-01-02T00:00:00Z",
                cutoff_hour=9,
                cutoff_minute=30,
                elexon_client=self.mock_client,
                processor=self.processor,
            )
        )
        self.assertEqual(res.date, "2026-01-02")
        self.assertGreater(len(res.publications), 0)
        # Publications should indicate whether they were eligible before cutoff
        eligible_items = [p for p in res.publications if p.eligibleBeforeCutoff]
        ineligible_items = [p for p in res.publications if not p.eligibleBeforeCutoff]
        self.assertGreater(len(eligible_items), 0)
        self.assertGreater(len(ineligible_items), 0)
        # The public API contract exposes the upstream WINDFOR field name.
        self.assertEqual(res.publications[0].generation, 12200.0)

    def test_forecast_publications_preserves_missing_generation(self) -> None:
        """Missing upstream measurements must not be converted to zero MW."""
        class MissingGenerationClient(MockElexonClient):
            async def fetch_windfor(self, publish_from: Any, publish_to: Any) -> List[Dict[str, Any]]:
                return [
                    {
                        "dataset": "WINDFOR",
                        "publishTime": "2026-01-01T09:15:00Z",
                        "startTime": "2026-01-02T00:00:00Z",
                    }
                ]

        res = asyncio.run(
            get_forecast_publications(
                date="2026-01-02",
                start_time="2026-01-02T00:00:00Z",
                cutoff_hour=9,
                cutoff_minute=30,
                elexon_client=MissingGenerationClient(),
                processor=self.processor,
            )
        )
        self.assertIsNone(res.publications[0].generation)

    def test_shortfall_endpoint_calculation(self) -> None:
        """Verify POST /api/shortfall computes demand minus wind forecast."""
        # Case 1: Demand > Forecast -> Positive shortfall
        req1 = ShortfallRequest(demand_mw=30000.0, forecast_mw=12000.0)
        res1 = asyncio.run(calculate_shortfall(req1))
        self.assertEqual(res1.demand_mw, 30000.0)
        self.assertEqual(res1.forecast_mw, 12000.0)
        self.assertEqual(res1.shortfall_mw, 18000.0)
        self.assertIn("shortfall", res1.disclaimer.lower())

        # Case 2: Demand < Forecast -> Zero shortfall (clamped at 0)
        req2 = ShortfallRequest(demand_mw=10000.0, forecast_mw=15000.0)
        res2 = asyncio.run(calculate_shortfall(req2))
        self.assertEqual(res2.shortfall_mw, 0.0)

    def test_shortfall_endpoint_negative_validation(self) -> None:
        """Verify POST /api/shortfall rejects negative demand or forecast."""
        with self.assertRaises(Exception) as ctx:
            req_neg = ShortfallRequest(demand_mw=-100.0, forecast_mw=5000.0)
            asyncio.run(calculate_shortfall(req_neg))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_upstream_elexon_error_handling(self) -> None:
        """Verify endpoints raise HTTP 502/503 when Elexon upstream service fails."""
        failing_client = MockElexonClient(should_fail=True, fail_status=502)
        with self.assertRaises(Exception) as ctx:
            asyncio.run(
                get_forecasts(
                    date="2026-01-02",
                    cutoff_hour=9,
                    cutoff_minute=30,
                    elexon_client=failing_client,
                    processor=self.processor,
                    calculator=self.calculator,
                )
            )
        self.assertEqual(ctx.exception.status_code, 502)


# Pytest bridge functions
def test_health_pytest():
    t = TestAPIEndpoints()
    t.setUp()
    t.test_health_endpoint()


def test_metadata_pytest():
    t = TestAPIEndpoints()
    t.setUp()
    t.test_metadata_endpoint()


def test_forecasts_pytest():
    t = TestAPIEndpoints()
    t.setUp()
    t.test_forecasts_endpoint()


def test_shortfall_pytest():
    t = TestAPIEndpoints()
    t.setUp()
    t.test_shortfall_endpoint_calculation()


if __name__ == "__main__":
    unittest.main()
