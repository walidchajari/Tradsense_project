from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
import asyncio
import os
import time

from .db import models
from .db.database import SessionLocal, engine, get_db
from .api import market, challenges, extra, compat, auth
from .services.market_scraper_casablanca import scrape_casablanca_live_overview
from .services.auth import hash_password

def load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        return

load_env_file(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TradeSense AI API",
    description="API for the TradeSense AI trading platform.",
    version="1.0.0"
)

# Enable gzip compression for faster payload delivery.
app.add_middleware(GZipMiddleware, minimum_size=1024)

# --- Seeder Function ---
def seed_challenges(db: Session):
    if db.query(models.Challenge).first() is None:
        c1 = models.Challenge(name="Starter", price_dh=200, initial_balance=5000)
        c2 = models.Challenge(name="Pro", price_dh=500, initial_balance=25000)
        c3 = models.Challenge(name="Elite", price_dh=1000, initial_balance=100000)
        db.add_all([c1, c2, c3])
        db.commit()
        print("Challenges seeded!")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@tradesense.ai").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_user = db.query(models.User).filter_by(email=admin_email).first()
    if admin_user is None:
        base_username = (admin_email.split("@", 1)[0] or "admin").strip()
        username = base_username
        suffix = 1
        while db.query(models.User).filter_by(username=username).first() is not None:
            suffix += 1
            username = f"{base_username}{suffix}"
        admin_user = models.User(
            username=username,
            email=admin_email,
            password_hash=hash_password(admin_password),
            is_admin=1,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print("Admin user seeded!")
    else:
        updated = False
        if not admin_user.is_admin:
            admin_user.is_admin = 1
            updated = True
        if not admin_user.password_hash:
            admin_user.password_hash = hash_password(admin_password)
            updated = True
        if updated:
            db.add(admin_user)
            db.commit()
    mock_user = db.query(models.User).filter_by(email="trader@tradesense.ai").first()
    if mock_user is None:
        mock_user = models.User(username="trader1", email="trader@tradesense.ai")
        db.add(mock_user)
        db.commit()
        db.refresh(mock_user)
        print("Mock user seeded!")

    if mock_user:
        has_account = db.query(models.Account).filter_by(user_id=mock_user.id).first()
        if has_account is None:
            demo_balance = 10000.0
            demo_account = models.Account(
                user_id=mock_user.id,
                balance=demo_balance,
                equity=demo_balance,
                initial_balance=demo_balance,
                daily_starting_equity=demo_balance,
                challenge_type="demo",
                status="active",
            )
            db.add(demo_account)
            db.commit()
            print("Demo account seeded for mock user!")

    paypal_client_id = os.environ.get("PAYPAL_CLIENT_ID", "").strip()
    paypal_client_secret = os.environ.get("PAYPAL_CLIENT_SECRET", "").strip()
    if paypal_client_id and paypal_client_secret:
        paypal_mode = os.environ.get("PAYPAL_MODE", "sandbox").strip() or "sandbox"
        paypal_currency = os.environ.get("PAYPAL_CURRENCY", "USD").strip() or "USD"
        db.query(models.PayPalConfig).delete()
        db.add(
            models.PayPalConfig(
                client_id=paypal_client_id,
                client_secret=paypal_client_secret,
                mode=paypal_mode,
                currency_code=paypal_currency,
            )
        )
        db.commit()
        print("PayPal config seeded from env.")

# --- Startup Event ---
@app.on_event("startup")
def on_startup():
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        user_columns = {col["name"] for col in inspector.get_columns("users")}
        if "is_admin" not in user_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))
    if "trades" in inspector.get_table_names():
        trade_columns = {col["name"] for col in inspector.get_columns("trades")}
        if "take_profit" not in trade_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trades ADD COLUMN take_profit FLOAT"))
        if "stop_loss" not in trade_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trades ADD COLUMN stop_loss FLOAT"))
    if "contact_messages" in inspector.get_table_names():
        contact_columns = {col["name"] for col in inspector.get_columns("contact_messages")}
        if "reply_message" not in contact_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE contact_messages ADD COLUMN reply_message VARCHAR"))
        if "replied_by" not in contact_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE contact_messages ADD COLUMN replied_by VARCHAR(120)"))
        if "replied_at" not in contact_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE contact_messages ADD COLUMN replied_at DATETIME"))

    db = SessionLocal()
    seed_challenges(db)
    db.close()

    async def warm_cache_loop():
        interval = int(os.environ.get("MARKET_PRELOAD_INTERVAL", "12"))
        interval = max(5, min(interval, 60))
        while True:
            try:
                await market.get_market_overview()
                await asyncio.to_thread(scrape_casablanca_live_overview)
            except Exception:
                pass
            await asyncio.sleep(interval)

    app.state.warm_cache_task = asyncio.create_task(warm_cache_loop())

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(challenges.router)
app.include_router(extra.router)
app.include_router(compat.router)
app.include_router(auth.router)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "TradeSense AI Backend"}
