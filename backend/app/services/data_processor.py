"""Data processing and temporal alignment service for WindSight."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
from dateutil import parser as dt_parser

try:
    from app.schemas.models import ForecastInterval
except ImportError:
    from backend.app.schemas.models import ForecastInterval

logger = logging.getLogger(__name__)


class DataProcessor:
    """Processes, filters, deduplicates, and aligns wind forecasts and actual generation data.

    TEMPORAL RESOLUTION AND ALIGNMENT STRATEGY:
    -------------------------------------------
    - Elexon WINDFOR dataset publishes forecasted national wind generation at HOURLY intervals
      (e.g., 00:00, 01:00, 02:00 UTC).
    - Elexon FUELHH dataset publishes actual fuel generation by fuelType at HALF-HOURLY intervals
      (settlement periods 1 to 48, e.g., 00:00-00:30, 00:30-01:00 UTC).
    - 30-Minute Settlement Alignment:
      Every 30-minute settlement period outturn in FUELHH is preserved at its native resolution
      (no averaging of two half-hour actuals into one hourly actual).
      Each 30-minute settlement period (both :00 and :30 within hour H) is evaluated against
      the prevailing hourly forecast rate issued for hour H [H:00 to H+1:00).
      This directly reflects the UK market settlement structure (48 settlement periods per day)
      without synthesizing artificial half-hour forecast fluctuations.

    DECISION CUTOFF CONVENTION:
    --------------------------
    - The UK day-ahead electricity auction (EPEX SPOT) gate closure occurs at 09:30 UK time
      (09:30 GMT / UTC in January).
    - The day-ahead cutoff for any delivery day D is assumed to be 09:30 UTC on day D-1.
    - Only forecast publications with publishTime <= (Day D-1 at 09:30 UTC) are eligible as
      day-ahead forecasts. The latest publication prior to or exactly at this cutoff is chosen.
    """

    @staticmethod
    def _to_utc_datetime(val: Union[datetime, str]) -> datetime:
        """Parse string or datetime into a UTC timezone-aware datetime."""
        if isinstance(val, str):
            dt = dt_parser.parse(val)
        elif isinstance(val, datetime):
            dt = val
        else:
            raise TypeError(f"Expected str or datetime, got {type(val)}")

        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def filter_wind_actuals(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter raw FUELHH records down to fuelType == 'WIND'."""
        filtered = []
        for r in records:
            fuel_type = str(r.get("fuelType", "")).strip().upper()
            if fuel_type == "WIND":
                filtered.append(r)
        return filtered

    def parse_timestamps(
        self,
        records: List[Dict[str, Any]],
        time_fields: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Parse ISO string timestamps into timezone-aware UTC datetime objects."""
        if time_fields is None:
            time_fields = ["publishTime", "startTime"]

        parsed_records = []
        for r in records:
            item = dict(r)
            for f in time_fields:
                if f in item and item[f] is not None:
                    item[f] = self._to_utc_datetime(item[f])
            parsed_records.append(item)
        return parsed_records

    def deduplicate_actuals(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate actuals by startTime, keeping the record with the latest publishTime."""
        by_start_time: Dict[datetime, Dict[str, Any]] = {}

        for r in records:
            start_dt = self._to_utc_datetime(r["startTime"])
            pub_dt = self._to_utc_datetime(r["publishTime"]) if "publishTime" in r and r["publishTime"] else datetime.min.replace(tzinfo=timezone.utc)

            if start_dt not in by_start_time:
                by_start_time[start_dt] = r
            else:
                existing_pub = self._to_utc_datetime(by_start_time[start_dt]["publishTime"]) if "publishTime" in by_start_time[start_dt] and by_start_time[start_dt]["publishTime"] else datetime.min.replace(tzinfo=timezone.utc)
                if pub_dt >= existing_pub:
                    by_start_time[start_dt] = r

        # Return sorted by startTime
        return sorted(by_start_time.values(), key=lambda x: self._to_utc_datetime(x["startTime"]))

    def deduplicate_forecasts(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Preserve all publication revisions while removing exact duplicates on (startTime, publishTime)."""
        seen: set[Tuple[datetime, datetime, Optional[float]]] = set()
        deduped = []

        for r in records:
            start_dt = self._to_utc_datetime(r["startTime"])
            pub_dt = self._to_utc_datetime(r["publishTime"])
            # Preserve an omitted upstream measurement as missing; it is not a
            # zero-MW forecast and must not collapse with a genuine zero value.
            raw_generation = r.get("generation")
            gen = float(raw_generation) if raw_generation is not None else None
            key = (start_dt, pub_dt, gen)

            if key not in seen:
                seen.add(key)
                deduped.append(r)

        return sorted(deduped, key=lambda x: (self._to_utc_datetime(x["startTime"]), self._to_utc_datetime(x["publishTime"])))

    def select_eligible_forecast(
        self,
        forecasts_for_interval: List[Dict[str, Any]],
        cutoff_datetime: datetime,
    ) -> Optional[Dict[str, Any]]:
        """Select the latest forecast published on or before the cutoff timestamp."""
        cutoff_utc = self._to_utc_datetime(cutoff_datetime)
        eligible = [
            f for f in forecasts_for_interval
            if self._to_utc_datetime(f["publishTime"]) <= cutoff_utc
        ]
        if not eligible:
            return None

        # Return the one with maximum publishTime
        return max(eligible, key=lambda f: self._to_utc_datetime(f["publishTime"]))

    def align_forecast_to_actuals(
        self,
        forecasts: List[Dict[str, Any]],
        actuals: List[Dict[str, Any]],
    ) -> Dict[datetime, Tuple[Optional[Dict[str, Any]], Optional[float]]]:
        """Align half-hourly FUELHH actuals with applicable WINDFOR forecasts.

        Preserves each actual record at its native 30-minute settlement period resolution.
        Returns a mapping from 30-minute delivery startTime (UTC) to a tuple of:
        (applicable_forecast, native_actual_generation_mw).
        """
        # Clean and deduplicate actuals (fuelType WIND and latest publishTime)
        wind_actuals = self.filter_wind_actuals(actuals)
        clean_actuals = self.deduplicate_actuals(wind_actuals)

        actuals_by_start: Dict[datetime, Optional[float]] = {}
        for act in clean_actuals:
            s_dt = self._to_utc_datetime(act["startTime"])
            raw_generation = act.get("generation")
            actuals_by_start[s_dt] = (
                float(raw_generation) if raw_generation is not None else None
            )

        clean_forecasts = self.deduplicate_forecasts(forecasts)
        forecasts_by_start: Dict[datetime, List[Dict[str, Any]]] = {}
        for fc in clean_forecasts:
            s_dt = self._to_utc_datetime(fc["startTime"])
            forecasts_by_start.setdefault(s_dt, []).append(fc)

        # Generate all 30-minute intervals
        all_intervals: set[datetime] = set(actuals_by_start.keys())
        for fc_hour in forecasts_by_start.keys():
            all_intervals.add(fc_hour)
            all_intervals.add(fc_hour + timedelta(minutes=30))

        aligned: Dict[datetime, Tuple[Optional[Dict[str, Any]], Optional[float]]] = {}

        for hh_dt in sorted(all_intervals):
            # Native actual for this 30-minute period
            actual_mw = actuals_by_start.get(hh_dt)

            # Applicable forecast hour
            hour_dt = hh_dt.replace(minute=0, second=0, microsecond=0)
            fc_list = forecasts_by_start.get(hour_dt, [])
            latest_fc = (
                max(fc_list, key=lambda f: self._to_utc_datetime(f["publishTime"]))
                if fc_list
                else None
            )

            aligned[hh_dt] = (latest_fc, actual_mw)

        return aligned

    def match_forecast_actual_pairs(
        self,
        forecasts: List[Dict[str, Any]],
        actuals: List[Dict[str, Any]],
        cutoff_hour: int = 9,
        cutoff_minute: int = 30,
    ) -> List[ForecastInterval]:
        """Match forecast and actual records at native 30-minute settlement period resolution.

        For each 30-minute delivery interval T on delivery date D:
        - The day-ahead cutoff is: Day (D - 1) at cutoff_hour:cutoff_minute UTC.
        - Applicable forecast: hourly forecast for T's hour [H:00, H+1:00) active at or before cutoff.
        - Actual generation: native 30-minute outturn for settlement interval T (no averaging).
        - Signed error = forecastGeneration - actualGeneration (positive = overprediction).
        - Absolute error = |signed error|
        """
        # Deduplicate actuals
        clean_actuals = self.deduplicate_actuals(self.filter_wind_actuals(actuals))
        actuals_by_start: Dict[datetime, Optional[float]] = {
            self._to_utc_datetime(act["startTime"]): (
                float(act["generation"]) if act.get("generation") is not None else None
            )
            for act in clean_actuals
        }

        # Deduplicate forecasts
        clean_forecasts = self.deduplicate_forecasts(forecasts)
        forecasts_by_start: Dict[datetime, List[Dict[str, Any]]] = {}
        for fc in clean_forecasts:
            s_dt = self._to_utc_datetime(fc["startTime"])
            forecasts_by_start.setdefault(s_dt, []).append(fc)

        matched_intervals: List[ForecastInterval] = []

        # All half-hourly delivery intervals
        all_intervals: set[datetime] = set(actuals_by_start.keys())
        for fc_hour in forecasts_by_start.keys():
            all_intervals.add(fc_hour)
            all_intervals.add(fc_hour + timedelta(minutes=30))

        for hh_dt in sorted(all_intervals):
            delivery_date = hh_dt.date()
            day_ahead_date = delivery_date - timedelta(days=1)
            cutoff_dt = datetime(
                year=day_ahead_date.year,
                month=day_ahead_date.month,
                day=day_ahead_date.day,
                hour=cutoff_hour,
                minute=cutoff_minute,
                second=0,
                tzinfo=timezone.utc,
            )

            # Look up hourly forecasts for the hour containing this half-hour
            hour_dt = hh_dt.replace(minute=0, second=0, microsecond=0)
            fc_list = forecasts_by_start.get(hour_dt, [])
            chosen_fc = self.select_eligible_forecast(fc_list, cutoff_dt)
            is_eligible = chosen_fc is not None

            # If no forecast was published at or before cutoff, pick earliest as fallback
            if chosen_fc is None and fc_list:
                chosen_fc = min(fc_list, key=lambda f: self._to_utc_datetime(f["publishTime"]))
                is_eligible = False

            # Native 30-minute actual generation
            actual_val = actuals_by_start.get(hh_dt)
            actual_gen = round(actual_val, 2) if actual_val is not None else None

            # Forecast generation
            if chosen_fc is not None:
                raw_forecast_generation = chosen_fc.get("generation")
                forecast_gen = (
                    round(float(raw_forecast_generation), 2)
                    if raw_forecast_generation is not None
                    else None
                )
                pub_time = self._to_utc_datetime(chosen_fc["publishTime"]).strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                forecast_gen = None
                pub_time = None
                is_eligible = False

            # If interval has neither forecast nor actual, skip
            if chosen_fc is None and actual_gen is None:
                continue

            if actual_gen is not None and forecast_gen is not None:
                signed_err = round(forecast_gen - actual_gen, 2)
                abs_err = round(abs(signed_err), 2)
            else:
                signed_err = None
                abs_err = None

            interval = ForecastInterval(
                startTime=hh_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                forecastGeneration=forecast_gen,
                actualGeneration=actual_gen,
                publishTime=pub_time,
                signedError=signed_err,
                absoluteError=abs_err,
                forecastEligible=is_eligible,
            )
            matched_intervals.append(interval)

        return matched_intervals
