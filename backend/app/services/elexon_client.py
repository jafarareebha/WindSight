"""Client for Elexon BMRS API endpoints."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Union
from dateutil import parser as dt_parser

try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False
    httpx = None  # type: ignore


class ElexonAPIError(Exception):
    """Exception raised when an error occurs while communicating with Elexon API."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ElexonClient:
    """Async HTTP client for querying Elexon BMRS API datasets."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        client: Optional[Any] = None,
    ) -> None:
        self.base_url = (base_url or settings.ELEXON_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.REQUEST_TIMEOUT
        self.max_retries = max_retries or settings.MAX_RETRIES
        self._external_client = client

    def _ensure_iso_utc(self, dt_val: Union[datetime, str]) -> str:
        """Convert a datetime or string to ISO 8601 UTC formatted string with Z suffix."""
        if isinstance(dt_val, str):
            # Parse if string
            parsed = dt_parser.parse(dt_val)
        else:
            parsed = dt_val

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)

        return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")

    def _split_into_chunks(
        self,
        start_dt: datetime,
        end_dt: datetime,
        chunk_days: int = 7,
    ) -> List[tuple[datetime, datetime]]:
        """Split a long time span into smaller chunks of maximum chunk_days."""
        chunks = []
        current_start = start_dt
        delta = timedelta(days=chunk_days)

        while current_start < end_dt:
            current_end = min(current_start + delta, end_dt)
            chunks.append((current_start, current_end))
            current_start = current_end

        return chunks

    async def _request_with_retries(
        self,
        client: Any,
        url: str,
        params: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        """Perform an HTTP GET request with exponential backoff retries."""
        last_exception: Optional[Exception] = None

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    "Elexon API request [Attempt %d/%d]: GET %s params=%s",
                    attempt,
                    self.max_retries,
                    url,
                    params,
                )
                response = await client.get(url, params=params, timeout=self.timeout)

                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        return data
                    elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                        return data["data"]
                    return []
                elif 400 <= response.status_code < 500:
                    logger.warning(
                        "Elexon client error %d from %s: %s",
                        response.status_code,
                        url,
                        response.text,
                    )
                    raise ElexonAPIError(
                        f"Elexon API returned client error {response.status_code}: {response.text}",
                        status_code=response.status_code,
                    )
                else:
                    logger.warning(
                        "Elexon server error %d from %s (attempt %d): %s",
                        response.status_code,
                        url,
                        attempt,
                        response.text,
                    )
                    last_exception = ElexonAPIError(
                        f"Elexon API returned server error {response.status_code}",
                        status_code=response.status_code,
                    )
            except (ElexonAPIError,) as e:
                # 4xx client errors should not be retried
                if e.status_code and 400 <= e.status_code < 500:
                    raise
                last_exception = e
            except Exception as e:
                logger.warning("Elexon request network/transport error (attempt %d): %s", attempt, str(e))
                last_exception = e

            if attempt < self.max_retries:
                backoff_time = 0.5 * (2 ** (attempt - 1))
                await asyncio.sleep(backoff_time)

        raise ElexonAPIError(
            f"Failed to fetch data from Elexon after {self.max_retries} attempts: {last_exception}"
        )

    async def fetch_fuelhh(
        self,
        start_date: Union[datetime, str],
        end_date: Union[datetime, str],
    ) -> List[Dict[str, Any]]:
        """Fetch actual fuel generation records (FUELHH stream) between publish timestamps.

        Note: FUELHH publishDateTimeFrom and publishDateTimeTo filter by publishTime.
        Actuals are typically published ~30-60 minutes after each settlement period.
        """
        start_iso = self._ensure_iso_utc(start_date)
        end_iso = self._ensure_iso_utc(end_date)
        start_dt = dt_parser.parse(start_iso)
        end_dt = dt_parser.parse(end_iso)

        if start_dt > end_dt:
            raise ValueError(f"start_date ({start_iso}) must be <= end_date ({end_iso})")

        url = f"{self.base_url}/datasets/FUELHH/stream"
        chunks = self._split_into_chunks(start_dt, end_dt, chunk_days=7)

        all_records: List[Dict[str, Any]] = []

        if self._external_client:
            client = self._external_client
            for c_start, c_end in chunks:
                params = {
                    "publishDateTimeFrom": self._ensure_iso_utc(c_start),
                    "publishDateTimeTo": self._ensure_iso_utc(c_end),
                }
                chunk_data = await self._request_with_retries(client, url, params)
                all_records.extend(chunk_data)
        elif HAS_HTTPX and httpx:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for c_start, c_end in chunks:
                    params = {
                        "publishDateTimeFrom": self._ensure_iso_utc(c_start),
                        "publishDateTimeTo": self._ensure_iso_utc(c_end),
                    }
                    chunk_data = await self._request_with_retries(client, url, params)
                    all_records.extend(chunk_data)
        else:
            raise RuntimeError("httpx is required to make HTTP requests with ElexonClient")

        return all_records

    async def fetch_windfor(
        self,
        publish_from: Union[datetime, str],
        publish_to: Union[datetime, str],
    ) -> List[Dict[str, Any]]:
        """Fetch wind generation forecast records (WINDFOR stream) between publish timestamps.

        Note: WINDFOR publishDateTimeFrom and publishDateTimeTo filter by publication time.
        Forecasts for delivery day D are published from Day D-1 (or earlier) up to delivery.
        """
        start_iso = self._ensure_iso_utc(publish_from)
        end_iso = self._ensure_iso_utc(publish_to)
        start_dt = dt_parser.parse(start_iso)
        end_dt = dt_parser.parse(end_iso)

        if start_dt > end_dt:
            raise ValueError(f"publish_from ({start_iso}) must be <= publish_to ({end_iso})")

        url = f"{self.base_url}/datasets/WINDFOR/stream"
        chunks = self._split_into_chunks(start_dt, end_dt, chunk_days=7)

        all_records: List[Dict[str, Any]] = []

        if self._external_client:
            client = self._external_client
            for c_start, c_end in chunks:
                params = {
                    "publishDateTimeFrom": self._ensure_iso_utc(c_start),
                    "publishDateTimeTo": self._ensure_iso_utc(c_end),
                }
                chunk_data = await self._request_with_retries(client, url, params)
                all_records.extend(chunk_data)
        elif HAS_HTTPX and httpx:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for c_start, c_end in chunks:
                    params = {
                        "publishDateTimeFrom": self._ensure_iso_utc(c_start),
                        "publishDateTimeTo": self._ensure_iso_utc(c_end),
                    }
                    chunk_data = await self._request_with_retries(client, url, params)
                    all_records.extend(chunk_data)
        else:
            raise RuntimeError("httpx is required to make HTTP requests with ElexonClient")

        return all_records
