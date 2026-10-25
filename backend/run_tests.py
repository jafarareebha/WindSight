"""Test runner for WindSight backend suite."""

import sys
import unittest
from pathlib import Path

# Add backend and parent directory to sys.path
backend_dir = Path(__file__).resolve().parent
parent_dir = backend_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))


def run_tests() -> int:
    """Discover and execute all unit and integration tests."""
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(backend_dir / "tests"), pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)
