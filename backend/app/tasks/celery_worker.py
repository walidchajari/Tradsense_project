import os
from celery import Celery
from celery.schedules import crontab

# Create Celery app
celery = Celery(__name__)
celery.conf.broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379")
celery.conf.result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379")

@celery.task(name="celery_worker.evaluate_all_accounts_task")
def evaluate_all_accounts_task():
    """
    A Celery task to evaluate all active accounts.
    This replaces the APScheduler job.
    """
    # We need a database session to interact with the DB.
    from ..db.database import SessionLocal
    from ..services.challenge_engine import ChallengeEngine

    db = SessionLocal()
    try:
        print("Celery task: Evaluating all active accounts...")
        # This function needs to be created in ChallengeEngine
        ChallengeEngine.evaluate_all_active_accounts_celery(db)
        print("Celery task: Evaluation finished.")
    finally:
        db.close()

# Define the periodic task schedule
celery.conf.beat_schedule = {
    "evaluate-every-60-seconds": {
        "task": "celery_worker.evaluate_all_accounts_task",
        "schedule": 60.0,  # Run every 60 seconds
    },
}
