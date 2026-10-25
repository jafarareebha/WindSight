"""Accuracy metric calculations for wind generation forecasts."""

import math
from typing import Dict, List, Optional, Tuple, Union

try:
    from app.schemas.models import AccuracyMetrics, ForecastInterval
except ImportError:
    from backend.app.schemas.models import AccuracyMetrics, ForecastInterval


class AccuracyCalculator:
    """Calculates statistical accuracy metrics comparing forecast vs actual wind generation.

    METRICS CONVENTIONS:
    -------------------
    - signed_error = forecast - actual (MW)
    - MAE: Mean Absolute Error = mean(|signed_error|) (MW)
    - RMSE: Root Mean Squared Error = sqrt(mean(signed_error^2)) (MW)
    - Bias: Mean Signed Error = mean(signed_error) (MW).
      * Positive bias indicates systematic overestimation / overprediction.
      * Negative bias indicates systematic underestimation / underprediction.
    - MAPE: Mean Absolute Percentage Error = mean(|forecast - actual| / actual) * 100%.
      * Only computed when all evaluated actual generation values are strictly positive (> 0 MW).
      * Evaluates to None if any actual value is <= 0 or if the set is empty.
    - Overprediction %: Percentage of valid intervals where forecast > actual.
    - Underprediction %: Percentage of valid intervals where forecast < actual.
    - Count: Number of matched, valid forecast-actual pairs.
    - Coverage: count / total_expected_intervals (clamped between 0.0 and 1.0).
    """

    def calculate_metrics(
        self,
        pairs: List[Union[ForecastInterval, dict]],
        total_expected: Optional[int] = None,
        only_eligible: bool = True,
    ) -> AccuracyMetrics:
        """Compute statistical accuracy metrics for matched forecast-actual intervals.

        Args:
            pairs: List of ForecastInterval objects or dicts with forecastGeneration and actualGeneration.
            total_expected: Optional expected count of intervals in the evaluation period.
            only_eligible: If True, only include intervals marked as forecastEligible.

        Returns:
            AccuracyMetrics object containing MAE, RMSE, Bias, MAPE, Count, Coverage, and error splits.
        """
        valid_pairs: Dict[str, Tuple[float, float]] = {}

        total_input_count = len(pairs)

        for index, p in enumerate(pairs):
            if isinstance(p, dict):
                fc = p.get("forecastGeneration")
                act = p.get("actualGeneration")
                eligible = p.get("forecastEligible", True)
                start_time = p.get("startTime")
            else:
                fc = getattr(p, "forecastGeneration", None)
                act = getattr(p, "actualGeneration", None)
                eligible = getattr(p, "forecastEligible", True)
                start_time = getattr(p, "startTime", None)

            if only_eligible and not eligible:
                continue

            if fc is None or act is None:
                continue

            try:
                forecast = float(fc)
                actual = float(act)
            except (TypeError, ValueError):
                continue

            if not math.isfinite(forecast) or not math.isfinite(actual):
                continue

            # One delivery timestamp represents one interval even if the source
            # contains duplicate records.
            interval_key = str(start_time) if start_time is not None else f"__input_{index}"
            valid_pairs.setdefault(interval_key, (forecast, actual))

        valid_forecasts = [pair[0] for pair in valid_pairs.values()]
        valid_actuals = [pair[1] for pair in valid_pairs.values()]
        valid_errors = [forecast - actual for forecast, actual in valid_pairs.values()]
        overpredict_count = sum(error > 0.0 for error in valid_errors)
        underpredict_count = sum(error < 0.0 for error in valid_errors)

        count = len(valid_errors)

        # Handle empty pairs gracefully
        if count == 0:
            return AccuracyMetrics(
                mae=None,
                rmse=None,
                bias=None,
                mape=None,
                count=0,
                coverage=0.0,
                overpredictionPct=None,
                underpredictionPct=None,
            )

        # Coverage calculation
        if total_expected is not None and total_expected > 0:
            coverage = min(1.0, max(0.0, count / total_expected))
        elif total_input_count > 0:
            coverage = min(1.0, max(0.0, count / total_input_count))
        else:
            coverage = 1.0

        coverage = round(coverage, 4)

        # MAE
        mae = round(sum(abs(e) for e in valid_errors) / count, 2)

        # RMSE
        rmse = round(math.sqrt(sum(e ** 2 for e in valid_errors) / count), 2)

        # Bias (Positive = overestimate)
        bias = round(sum(valid_errors) / count, 2)

        # MAPE (Only when all actuals > 0)
        mape: Optional[float] = None
        if all(act > 0 for act in valid_actuals):
            mape_sum = sum(abs(fc - act) / act for fc, act in zip(valid_forecasts, valid_actuals))
            mape = round((mape_sum / count) * 100.0, 2)

        # Over / Under prediction percentage
        overprediction_pct = round((overpredict_count / count) * 100.0, 2)
        underprediction_pct = round((underpredict_count / count) * 100.0, 2)

        return AccuracyMetrics(
            mae=mae,
            rmse=rmse,
            bias=bias,
            mape=mape,
            count=count,
            coverage=coverage,
            overpredictionPct=overprediction_pct,
            underpredictionPct=underprediction_pct,
        )
