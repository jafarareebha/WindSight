"""Pytest fixtures and test data generators for WindSight test suite."""

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

try:
    import pytest
    HAS_PYTEST = True
except ImportError:
    HAS_PYTEST = False


def get_sample_fuelhh_raw() -> List[Dict[str, Any]]:
    """Generate realistic raw FUELHH records containing WIND and non-WIND generation."""
    return [
        # 2026-01-02 Period 1 (00:00 - 00:30 UTC)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T01:05:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 12000,
        },
        # Period 1 CCGT (should be filtered out)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T01:05:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 1,
            "fuelType": "CCGT",
            "generation": 18000,
        },
        # Period 1 duplicate with older publishTime (should be replaced by newer)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T00:40:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 11950,
        },
        # Period 2 (00:30 - 01:00 UTC)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T01:35:00Z",
            "startTime": "2026-01-02T00:30:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 13000,
        },
        # Period 3 (01:00 - 01:30 UTC)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T02:05:00Z",
            "startTime": "2026-01-02T01:00:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 3,
            "fuelType": "WIND",
            "generation": 14000,
        },
        # Period 4 (01:30 - 02:00 UTC)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-02T02:35:00Z",
            "startTime": "2026-01-02T01:30:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 4,
            "fuelType": "WIND",
            "generation": 15000,
        },
    ]


def get_sample_windfor_raw() -> List[Dict[str, Any]]:
    """Generate realistic raw WINDFOR records with multiple publication revisions."""
    return [
        # Delivery 2026-01-02 00:00:00 UTC (Cutoff is 2026-01-01 09:30:00 UTC)
        # Publication 1: Day D-1 07:30 UTC (Eligible)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T07:30:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "generation": 12200,
        },
        # Publication 2: Day D-1 09:15 UTC (Eligible, latest before 09:30 cutoff -> SHOULD BE SELECTED)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T09:15:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "generation": 12800,
        },
        # Publication 3: Day D-1 15:30 UTC (Ineligible for day-ahead auction cutoff)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T15:30:00Z",
            "startTime": "2026-01-02T00:00:00Z",
            "generation": 12400,
        },
        # Delivery 2026-01-02 01:00:00 UTC
        # Publication 1: Day D-1 09:00 UTC (Eligible -> SHOULD BE SELECTED)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T09:00:00Z",
            "startTime": "2026-01-02T01:00:00Z",
            "generation": 14200,
        },
        # Publication 2: Day D-1 21:00 UTC (Ineligible)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T21:00:00Z",
            "startTime": "2026-01-02T01:00:00Z",
            "generation": 14700,
        },
    ]


if HAS_PYTEST:
    @pytest.fixture
    def sample_fuelhh_records():
        return get_sample_fuelhh_raw()

    @pytest.fixture
    def sample_windfor_records():
        return get_sample_windfor_raw()
