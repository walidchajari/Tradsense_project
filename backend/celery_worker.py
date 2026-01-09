"""
Celery entrypoint shim for tooling that expects backend/celery_worker.py.
Use: celery -A celery_worker.celery worker --loglevel=info
"""

try:
    from backend.app.tasks.celery_worker import celery, evaluate_all_accounts_task
except ImportError:  # Running from backend/ as the working directory.
    from app.tasks.celery_worker import celery, evaluate_all_accounts_task

__all__ = ["celery", "evaluate_all_accounts_task"]

