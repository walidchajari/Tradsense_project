"""
FastAPI entrypoint shim for tooling that expects backend/main.py.
Use: uvicorn main:app --reload
"""

try:
    from backend.app.main import app
except ImportError:  # Running from backend/ as the working directory.
    from app.main import app

__all__ = ["app"]

