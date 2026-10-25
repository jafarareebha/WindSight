"""Comprehensive unit tests for AccuracyCalculator service."""

import math
from pathlib import Path
import sys
import unittest

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.schemas.models import ForecastInterval
from backend.app.services.accuracy_calculator import AccuracyCalculator


class TestAccuracyCalculator(unittest.TestCase):
    """Test suite verifying MAE, RMSE, Bias, MAPE, and edge condition handling."""

    def setUp(self) -> None:
        self.calc = AccuracyCalculator()

    def test_mae_calculation(self) -> None:
        """Verify Mean Absolute Error: mean(|fc - act|)."""
        # Pairs:
        # 1: fc=100, act=90 -> error = +10, abs = 10
        # 2: fc=80,  act=100 -> error = -20, abs = 20
        # 3: fc=150, act=150 -> error = 0,   abs = 0
        # MAE = (10 + 20 + 0) / 3 = 10.0
        intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=100.0, actualGeneration=90.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=80.0, actualGeneration=100.0),
            ForecastInterval(startTime="2026-01-01T02:00:00Z", forecastGeneration=150.0, actualGeneration=150.0),
        ]
        metrics = self.calc.calculate_metrics(intervals)
        self.assertEqual(metrics.mae, 10.0)
        self.assertEqual(metrics.count, 3)

    def test_rmse_calculation(self) -> None:
        """Verify Root Mean Squared Error: sqrt(mean(errors^2))."""
        # Errors: +10, -20, 0
        # Squared errors: 100, 400, 0 -> sum = 500
        # Mean squared error = 500 / 3 = 166.666...
        # RMSE = sqrt(166.666...) = 12.91
        intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=100.0, actualGeneration=90.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=80.0, actualGeneration=100.0),
            ForecastInterval(startTime="2026-01-01T02:00:00Z", forecastGeneration=150.0, actualGeneration=150.0),
        ]
        metrics = self.calc.calculate_metrics(intervals)
        expected_rmse = round(math.sqrt(500.0 / 3.0), 2)
        self.assertEqual(metrics.rmse, expected_rmse)

    def test_bias_sign_convention_positive_overestimate(self) -> None:
        """Verify Bias sign convention: positive indicates overestimate, negative underestimate."""
        # Systematic overestimate: forecast=120, actual=100 -> error=+20
        over_intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=120.0, actualGeneration=100.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=110.0, actualGeneration=100.0),
        ]
        metrics_over = self.calc.calculate_metrics(over_intervals)
        self.assertGreater(metrics_over.bias, 0.0)
        self.assertEqual(metrics_over.bias, 15.0)
        self.assertEqual(metrics_over.overpredictionPct, 100.0)
        self.assertEqual(metrics_over.underpredictionPct, 0.0)

        # Systematic underestimate: forecast=80, actual=100 -> error=-20
        under_intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=80.0, actualGeneration=100.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=90.0, actualGeneration=100.0),
        ]
        metrics_under = self.calc.calculate_metrics(under_intervals)
        self.assertLess(metrics_under.bias, 0.0)
        self.assertEqual(metrics_under.bias, -15.0)
        self.assertEqual(metrics_under.overpredictionPct, 0.0)
        self.assertEqual(metrics_under.underpredictionPct, 100.0)

    def test_mape_calculation_strictly_positive(self) -> None:
        """Verify MAPE calculation when all actual values are > 0."""
        # fc=110, act=100 -> abs_pct = 10 / 100 = 10%
        # fc=90,  act=100 -> abs_pct = 10 / 100 = 10%
        # MAPE = 10.0%
        intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=110.0, actualGeneration=100.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=90.0, actualGeneration=100.0),
        ]
        metrics = self.calc.calculate_metrics(intervals)
        self.assertEqual(metrics.mape, 10.0)

    def test_mape_with_zero_actual_returns_none(self) -> None:
        """Verify MAPE evaluates to None when any actual generation is <= 0 to avoid division by zero."""
        intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=100.0, actualGeneration=0.0),
            ForecastInterval(startTime="2026-01-01T01:00:00Z", forecastGeneration=90.0, actualGeneration=50.0),
        ]
        metrics = self.calc.calculate_metrics(intervals)
        self.assertIsNone(metrics.mape)
        # But MAE and RMSE still compute properly
        self.assertIsNotNone(metrics.mae)
        self.assertIsNotNone(metrics.rmse)

    def test_empty_pairs_graceful_handling(self) -> None:
        """Verify handling of completely empty list of intervals."""
        metrics = self.calc.calculate_metrics([])
        self.assertEqual(metrics.count, 0)
        self.assertEqual(metrics.coverage, 0.0)
        self.assertIsNone(metrics.mae)
        self.assertIsNone(metrics.rmse)
        self.assertIsNone(metrics.bias)
        self.assertIsNone(metrics.mape)
        self.assertIsNone(metrics.overpredictionPct)
        self.assertIsNone(metrics.underpredictionPct)

    def test_division_by_zero_protection(self) -> None:
        """Verify that total_expected=0 does not cause ZeroDivisionError."""
        intervals = [
            ForecastInterval(startTime="2026-01-01T00:00:00Z", forecastGeneration=100.0, actualGeneration=100.0)
        ]
        metrics = self.calc.calculate_metrics(intervals, total_expected=0)
        self.assertEqual(metrics.count, 1)
        self.assertEqual(metrics.mae, 0.0)
        self.assertEqual(metrics.rmse, 0.0)

    def test_coverage_calculation(self) -> None:
        """Verify coverage calculation against expected intervals (48 half-hour intervals for 1 day)."""
        intervals = [
            ForecastInterval(
                startTime=f"2026-01-01T{h:02d}:{m:02d}:00Z",
                forecastGeneration=100.0,
                actualGeneration=100.0,
            )
            for h in range(24)
            for m in (0, 30)
        ]  # 48 half-hour intervals in a complete day
        # 36 intervals out of 48 expected
        metrics = self.calc.calculate_metrics(intervals[:36], total_expected=48)
        self.assertEqual(metrics.count, 36)
        self.assertEqual(metrics.coverage, round(36 / 48, 4))  # 0.75

    def test_january_cohort_expected_intervals_1488(self) -> None:
        """January 2026 has 31 days * 48 half-hour settlement periods = 1,488 expected intervals."""
        days_in_january = 31
        periods_per_day = 48
        expected_intervals = days_in_january * periods_per_day
        self.assertEqual(expected_intervals, 1488)

        # 1488 intervals perfectly matched -> 1.0 coverage
        dummy_intervals = [
            ForecastInterval(
                startTime=f"2026-01-01T00:00:00Z",
                forecastGeneration=100.0,
                actualGeneration=100.0,
            )
        ]
        metrics = self.calc.calculate_metrics(dummy_intervals, total_expected=1488)
        self.assertEqual(metrics.count, 1)
        self.assertEqual(metrics.coverage, round(1 / 1488, 4))

    def test_coverage_uses_distinct_finite_delivery_intervals(self) -> None:
        """Duplicate, missing, and non-finite values must not inflate coverage."""
        pairs = [
            {"startTime": "2026-01-01T00:00:00Z", "forecastGeneration": 100, "actualGeneration": 90},
            {"startTime": "2026-01-01T00:00:00Z", "forecastGeneration": 100, "actualGeneration": 90},
            {"startTime": "2026-01-01T00:30:00Z", "forecastGeneration": None, "actualGeneration": 90},
            {"startTime": "2026-01-01T01:00:00Z", "forecastGeneration": float("nan"), "actualGeneration": 90},
            {"startTime": "2026-01-01T01:30:00Z", "forecastGeneration": 100, "actualGeneration": 90},
        ]
        metrics = self.calc.calculate_metrics(pairs, total_expected=48)
        self.assertEqual(metrics.count, 2)
        self.assertEqual(metrics.coverage, round(2 / 48, 4))

    def test_dict_input_compatibility(self) -> None:
        """Verify that calculate_metrics also accepts plain dictionaries."""
        dict_intervals = [
            {"forecastGeneration": 120.0, "actualGeneration": 100.0, "forecastEligible": True},
            {"forecastGeneration": 90.0, "actualGeneration": 100.0, "forecastEligible": True},
        ]
        metrics = self.calc.calculate_metrics(dict_intervals)
        self.assertEqual(metrics.count, 2)
        self.assertEqual(metrics.mae, 15.0)


# Pytest bridge functions
def test_mae_pytest():
    t = TestAccuracyCalculator()
    t.setUp()
    t.test_mae_calculation()


def test_rmse_pytest():
    t = TestAccuracyCalculator()
    t.setUp()
    t.test_rmse_calculation()


def test_bias_pytest():
    t = TestAccuracyCalculator()
    t.setUp()
    t.test_bias_sign_convention_positive_overestimate()


def test_mape_zero_actual_pytest():
    t = TestAccuracyCalculator()
    t.setUp()
    t.test_mape_with_zero_actual_returns_none()


def test_empty_pairs_pytest():
    t = TestAccuracyCalculator()
    t.setUp()
    t.test_empty_pairs_graceful_handling()


if __name__ == "__main__":
    unittest.main()
