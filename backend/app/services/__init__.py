"""Services package initialization."""

try:
    from app.services.accuracy_calculator import AccuracyCalculator
    from app.services.data_processor import DataProcessor
    from app.services.elexon_client import ElexonAPIError, ElexonClient
except ImportError:
    from backend.app.services.accuracy_calculator import AccuracyCalculator
    from backend.app.services.data_processor import DataProcessor
    from backend.app.services.elexon_client import ElexonAPIError, ElexonClient

__all__ = [
    "AccuracyCalculator",
    "DataProcessor",
    "ElexonAPIError",
    "ElexonClient",
]
