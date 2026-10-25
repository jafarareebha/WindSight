"""Comprehensive unit tests for DataProcessor service."""

from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.services.data_processor import DataProcessor
from backend.tests.conftest import get_sample_fuelhh_raw, get_sample_windfor_raw


class TestDataProcessor(unittest.TestCase):
    """Test suite verifying filtering, deduplication, temporal alignment, and cutoff logic."""

    def setUp(self) -> None:
        self.processor = DataProcessor()
        self.raw_actuals = get_sample_fuelhh_raw()
        self.raw_forecasts = get_sample_windfor_raw()

    def test_filter_wind_actuals(self) -> None:
        """Verify that only fuelType=='WIND' records are retained, ignoring other fuel types."""
        filtered = self.processor.filter_wind_actuals(self.raw_actuals)
        self.assertGreater(len(filtered), 0)
        for record in filtered:
            self.assertEqual(record["fuelType"].upper(), "WIND")

        # Confirm non-wind (e.g. CCGT) was removed
        fuels = [r["fuelType"] for r in filtered]
        self.assertNotIn("CCGT", fuels)

    def test_filter_wind_actuals_empty_and_casing(self) -> None:
        """Test case-insensitivity and empty input list."""
        records = [
            {"fuelType": "wind", "generation": 100},
            {"fuelType": "WIND", "generation": 200},
            {"fuelType": "  Wind  ", "generation": 300},
            {"fuelType": "NUCLEAR", "generation": 500},
        ]
        filtered = self.processor.filter_wind_actuals(records)
        self.assertEqual(len(filtered), 3)
        self.assertEqual(self.processor.filter_wind_actuals([]), [])

    def test_parse_timestamps(self) -> None:
        """Verify ISO string timestamps are converted to timezone-aware UTC datetime."""
        records = [{"publishTime": "2026-01-01T09:30:00Z", "startTime": "2026-01-01T10:00:00Z"}]
        parsed = self.processor.parse_timestamps(records)

        self.assertIsInstance(parsed[0]["publishTime"], datetime)
        self.assertIsInstance(parsed[0]["startTime"], datetime)
        self.assertEqual(parsed[0]["publishTime"].tzinfo, timezone.utc)
        self.assertEqual(parsed[0]["startTime"].hour, 10)

    def test_deduplicate_actuals_keeps_latest_publish(self) -> None:
        """Ensure deduplicate_actuals keeps the record with latest publishTime for the same startTime."""
        wind_actuals = self.processor.filter_wind_actuals(self.raw_actuals)
        deduped = self.processor.deduplicate_actuals(wind_actuals)

        # Period 1 (startTime 2026-01-02T00:00:00Z) had two records:
        # 1) pub 00:40:00Z (gen 11950)
        # 2) pub 01:05:00Z (gen 12000) -> should be kept
        period1 = [r for r in deduped if str(r["startTime"]).startswith("2026-01-02T00:00:00")]
        self.assertEqual(len(period1), 1)
        self.assertEqual(period1[0]["generation"], 12000)

    def test_deduplicate_forecasts_preserves_multiple_publications(self) -> None:
        """Ensure deduplicate_forecasts retains all publication revisions for an interval."""
        deduped = self.processor.deduplicate_forecasts(self.raw_forecasts)

        # For delivery 2026-01-02T00:00:00Z, there are 3 distinct publications (07:30, 09:15, 15:30)
        p0_pubs = [r for r in deduped if str(r["startTime"]).startswith("2026-01-02T00:00:00")]
        self.assertEqual(len(p0_pubs), 3)

        # But exact duplicate should be deduplicated
        duplicated_input = self.raw_forecasts + [self.raw_forecasts[0]]
        deduped2 = self.processor.deduplicate_forecasts(duplicated_input)
        self.assertEqual(len(deduped2), len(self.raw_forecasts))

    def test_temporal_alignment_half_hourly_native(self) -> None:
        """Verify that two 30-min FUELHH periods remain separate and native, NOT averaged."""
        aligned = self.processor.align_forecast_to_actuals(
            forecasts=self.raw_forecasts,
            actuals=self.processor.filter_wind_actuals(self.raw_actuals),
        )

        p1 = datetime(2026, 1, 2, 0, 0, tzinfo=timezone.utc)
        p2 = datetime(2026, 1, 2, 0, 30, tzinfo=timezone.utc)
        p3 = datetime(2026, 1, 2, 1, 0, tzinfo=timezone.utc)
        p4 = datetime(2026, 1, 2, 1, 30, tzinfo=timezone.utc)

        self.assertIn(p1, aligned)
        self.assertIn(p2, aligned)
        self.assertIn(p3, aligned)
        self.assertIn(p4, aligned)

        # Period 1 actual is 12000.0 MW, Period 2 actual is 13000.0 MW (not averaged to 12500)
        _, act1 = aligned[p1]
        _, act2 = aligned[p2]
        self.assertEqual(act1, 12000.0)
        self.assertEqual(act2, 13000.0)
        self.assertNotEqual(act1, act2)

        # Period 3 actual is 14000.0 MW, Period 4 actual is 15000.0 MW
        _, act3 = aligned[p3]
        _, act4 = aligned[p4]
        self.assertEqual(act3, 14000.0)
        self.assertEqual(act4, 15000.0)

    def test_select_eligible_forecast_by_cutoff(self) -> None:
        """Verify selection of the latest forecast published on or before the cutoff."""
        cutoff = datetime(2026, 1, 1, 9, 30, tzinfo=timezone.utc)
        h0_forecasts = [r for r in self.raw_forecasts if "00:00:00" in str(r["startTime"])]

        chosen = self.processor.select_eligible_forecast(h0_forecasts, cutoff)
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen["generation"], 12800)  # Published at 09:15 UTC

        # If cutoff was 08:00 UTC, it should select 07:30 publication (12200 MW)
        early_cutoff = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        chosen_early = self.processor.select_eligible_forecast(h0_forecasts, early_cutoff)
        self.assertIsNotNone(chosen_early)
        self.assertEqual(chosen_early["generation"], 12200)

        # If cutoff was 06:00 UTC, no forecast eligible -> None
        too_early_cutoff = datetime(2026, 1, 1, 6, 0, tzinfo=timezone.utc)
        chosen_none = self.processor.select_eligible_forecast(h0_forecasts, too_early_cutoff)
        self.assertIsNone(chosen_none)

    def test_cutoff_boundary_rule_exact_timestamp(self) -> None:
        """A forecast published exactly at the cutoff is eligible; after is excluded."""
        cutoff = datetime(2026, 1, 1, 9, 30, 0, tzinfo=timezone.utc)
        forecasts = [
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:30:00Z", "generation": 11000},
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:30:01Z", "generation": 19000},
        ]
        chosen = self.processor.select_eligible_forecast(forecasts, cutoff)
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen["generation"], 11000)
        self.assertEqual(chosen["publishTime"], "2026-01-01T09:30:00Z")

    def test_match_forecast_actual_pairs_end_to_end(self) -> None:
        """Verify matching pairs at native 30-minute settlement period resolution."""
        matched = self.processor.match_forecast_actual_pairs(
            forecasts=self.raw_forecasts,
            actuals=self.raw_actuals,
            cutoff_hour=9,
            cutoff_minute=30,
        )

        self.assertEqual(len(matched), 4)

        # Interval 0 (00:00 UTC):
        # Forecast = 12800 MW (hourly forecast covering 00:00-01:00)
        # Actual = 12000 MW (native Period 1)
        # Signed error = 12800 - 12000 = +800 MW (overestimate)
        # Absolute error = 800 MW
        int0 = matched[0]
        self.assertEqual(int0.startTime, "2026-01-02T00:00:00Z")
        self.assertEqual(int0.forecastGeneration, 12800.0)
        self.assertEqual(int0.actualGeneration, 12000.0)
        self.assertEqual(int0.signedError, 800.0)
        self.assertEqual(int0.absoluteError, 800.0)
        self.assertTrue(int0.forecastEligible)

        # Interval 1 (00:30 UTC):
        # Forecast = 12800 MW (same hourly forecast covering 00:00-01:00)
        # Actual = 13000 MW (native Period 2)
        # Signed error = 12800 - 13000 = -200 MW (underestimate)
        # Absolute error = 200 MW
        int1 = matched[1]
        self.assertEqual(int1.startTime, "2026-01-02T00:30:00Z")
        self.assertEqual(int1.forecastGeneration, 12800.0)
        self.assertEqual(int1.actualGeneration, 13000.0)
        self.assertEqual(int1.signedError, -200.0)
        self.assertEqual(int1.absoluteError, 200.0)
        self.assertTrue(int1.forecastEligible)

        # Interval 2 (01:00 UTC):
        # Forecast = 14200 MW, Actual = 14000 MW -> error = +200 MW
        int2 = matched[2]
        self.assertEqual(int2.startTime, "2026-01-02T01:00:00Z")
        self.assertEqual(int2.forecastGeneration, 14200.0)
        self.assertEqual(int2.actualGeneration, 14000.0)
        self.assertEqual(int2.signedError, 200.0)
        self.assertEqual(int2.absoluteError, 200.0)

        # Interval 3 (01:30 UTC):
        # Forecast = 14200 MW, Actual = 15000 MW -> error = -800 MW
        int3 = matched[3]
        self.assertEqual(int3.startTime, "2026-01-02T01:30:00Z")
        self.assertEqual(int3.forecastGeneration, 14200.0)
        self.assertEqual(int3.actualGeneration, 15000.0)
        self.assertEqual(int3.signedError, -800.0)
        self.assertEqual(int3.absoluteError, 800.0)

    def test_missing_actual_data_handling(self) -> None:
        """Verify behavior when some half-hour actuals are missing."""
        # Only 1 half-hour actual provided (00:00)
        partial_actuals = [
            {
                "dataset": "FUELHH",
                "publishTime": "2026-01-02T01:05:00Z",
                "startTime": "2026-01-02T00:00:00Z",
                "settlementDate": "2026-01-02",
                "settlementPeriod": 1,
                "fuelType": "WIND",
                "generation": 10000,
            }
        ]

        matched = self.processor.match_forecast_actual_pairs(
            forecasts=self.raw_forecasts,
            actuals=partial_actuals,
            cutoff_hour=9,
            cutoff_minute=30,
        )

        # 00:00 has both forecast (12800) and actual (10000)
        h0 = [m for m in matched if "00:00:00" in str(m.startTime)][0]
        self.assertEqual(h0.actualGeneration, 10000.0)
        self.assertEqual(h0.signedError, 2800.0)

        # 00:30 has forecast (12800) but no actual -> actualGeneration=None, signedError=None
        h0_30 = [m for m in matched if "00:30:00" in str(m.startTime)][0]
        self.assertEqual(h0_30.forecastGeneration, 12800.0)
        self.assertIsNone(h0_30.actualGeneration)
        self.assertIsNone(h0_30.signedError)

        # 01:00 and 01:30: no actuals available -> actualGeneration=None, signedError=None
        h1 = [m for m in matched if "01:00:00" in str(m.startTime)][0]
        self.assertIsNone(h1.actualGeneration)
        self.assertIsNone(h1.signedError)


# Pytest bridge functions so pytest discovers them directly
def test_filter_wind_actuals_pytest():
    t = TestDataProcessor()
    t.setUp()
    t.test_filter_wind_actuals()


def test_deduplicate_actuals_pytest():
    t = TestDataProcessor()
    t.setUp()
    t.test_deduplicate_actuals_keeps_latest_publish()


def test_temporal_alignment_pytest():
    t = TestDataProcessor()
    t.setUp()
    t.test_temporal_alignment_half_hourly_native()


def test_select_eligible_forecast_pytest():
    t = TestDataProcessor()
    t.setUp()
    t.test_select_eligible_forecast_by_cutoff()


if __name__ == "__main__":
    unittest.main()
