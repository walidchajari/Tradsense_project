"""
FastAPI entrypoint shim for tooling that expects backend/main.py.
Use: uvicorn main:app --reload
"""

from typing import Any

try:
    from backend.app.main import app as _app
except ImportError:  # Running from backend/ as the working directory.
    from app.main import app as _app

_app: Any
app: Any = _app

__all__ = ["app"]
