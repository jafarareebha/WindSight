"""
Vercel Serverless Function entry point.
Adapts the FastAPI application for Vercel's Python runtime.
"""
import sys
import os

# Add the backend directory to the Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app  # noqa: E402

# Vercel expects the ASGI app to be named 'app' or 'handler'
# FastAPI is ASGI-compatible, so this works directly with Vercel's Python runtime
