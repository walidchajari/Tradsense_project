"""
FastAPI entrypoint shim for tooling that expects backend/app.py.
Use: uvicorn backend.main:app --reload
"""

try:
    from backend.app.main import app
except ImportError:  # Running from backend/ as the working directory.
    from app.main import app

__all__ = ["app"]


if __name__ == "__main__":
    import sys

    sys.stderr.write(
        "Use: uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload\n"
    )
