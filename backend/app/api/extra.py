from typing import Any, Dict, List, Optional, Tuple
import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import models
from ..db.database import get_db
from ..services.challenge_engine import ChallengeEngine
from .market_data import get_market_overview as market_overview_handler
from ..services.ai_service import AIService
from ..services.caching import cache
from ..services.access_control import require_funded_account
from ..services.casablanca_service import get_casablanca_live_data
from ..services.news_service import NewsService

try:
    import requests
except Exception:
    requests = None


router = APIRouter(prefix="/api", tags=["Extras"])


def require_admin(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
) -> models.User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token_row = db.query(models.AuthToken).filter_by(token=token).first()
    if token_row is None:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    user = db.query(models.User).get(token_row.user_id)
    if user is None or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
) -> models.User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token_row = db.query(models.AuthToken).filter_by(token=token).first()
    if token_row is None:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    user = db.query(models.User).get(token_row.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    return user


@router.get("/auth/keep-alive")
def keep_alive(user: models.User = Depends(require_user)) -> Dict[str, Any]:
    return {"status": "ok", "user_id": user.id, "email": user.email}


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _resolve_range(range_label: str, date_from: Optional[str], date_to: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    start = _parse_date(date_from)
    end = _parse_date(date_to)
    if start or end:
        return start, end
    label = (range_label or "7d").lower()
    now = datetime.utcnow()
    if label == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now
    if label == "30d":
        return now - timedelta(days=30), now
    if label == "90d":
        return now - timedelta(days=90), now
    return now - timedelta(days=7), now


def _get_cmi_urls() -> Dict[str, str]:
    frontend_url = (os.environ.get("CMI_FRONTEND_URL") or os.environ.get("FRONTEND_URL") or "http://localhost:8080").rstrip("/")
    backend_url = (os.environ.get("CMI_BACKEND_URL") or os.environ.get("BACKEND_URL") or "http://localhost:8001").rstrip("/")
    ok_url = os.environ.get("CMI_OK_URL") or f"{frontend_url}/dashboard/challenge?mode=paid"
    fail_url = os.environ.get("CMI_FAIL_URL") or f"{frontend_url}/checkout"
    callback_url = os.environ.get("CMI_CALLBACK_URL") or f"{backend_url}/api/cmi/callback"
    shop_url = os.environ.get("CMI_SHOP_URL") or frontend_url
    return {
        "ok_url": ok_url,
        "fail_url": fail_url,
        "callback_url": callback_url,
        "shop_url": shop_url,
    }


def _date_range_days(start: datetime, end: datetime) -> List[str]:
    days = []
    cursor = start.date()
    last = end.date()
    while cursor <= last:
        days.append(cursor.isoformat())
        cursor = cursor + timedelta(days=1)
    return days


def _date_range_weeks(end: datetime, count: int = 4) -> List[Tuple[datetime, datetime, str]]:
    buckets = []
    anchor = end.replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(count):
        week_end = anchor - timedelta(days=7 * i)
        week_start = week_end - timedelta(days=6)
        label = week_start.strftime("%b %d")
        buckets.append((week_start, week_end, label))
    return list(reversed(buckets))


class TradeRequest(BaseModel):
    account_id: int
    asset: str
    side: str
    quantity: float
    price: float
    market: Optional[str] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None


class PayPalConfigRequest(BaseModel):
    client_id: str
    client_secret: str
    mode: str = "sandbox"
    currency_code: str = "USD"

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: Optional[str] = None
    message: str

class ContactReplyRequest(BaseModel):
    reply: str
    status: Optional[str] = None


class AdminStatusRequest(BaseModel):
    status: str


class AdminAccountUpdateRequest(BaseModel):
    balance: Optional[float] = None
    equity: Optional[float] = None
    status: Optional[str] = None
    challenge_type: Optional[str] = None
    initial_balance: Optional[float] = None
    daily_starting_equity: Optional[float] = None


class AdminUserUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class AdminPasswordResetRequest(BaseModel):
    new_password: str


class PayPalOrderRequest(BaseModel):
    user_id: int
    challenge_id: int


class PayPalCaptureRequest(BaseModel):
    order_id: str
    user_id: int
    challenge_id: int


class CMIRequest(BaseModel):
    user_id: int
    challenge_id: int


class CryptoOrderRequest(BaseModel):
    user_id: int
    challenge_id: int


class CMIConfigRequest(BaseModel):
    store_id: str
    shared_secret: str
    mode: str = "test"


class CryptoConfigRequest(BaseModel):
    api_key: str
    api_secret: str
    merchant_id: Optional[str] = None


class WithdrawalRequest(BaseModel):
    account_id: int
    amount: float


class WithdrawalStatusRequest(BaseModel):
    status: str


class ChallengeActivationRequest(BaseModel):
    user_id: int
    challenge_id: int
    payment_method: Optional[str] = "manual"
    transaction_id: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    country: Optional[str] = None


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str


class AvatarUpdateRequest(BaseModel):
    avatar_data: str


class PreferencesUpdateRequest(BaseModel):
    preferred_language: Optional[str] = None
    dark_mode: Optional[bool] = None


def _get_withdrawal_threshold() -> float:
    try:
        return float(os.environ.get("WITHDRAW_MIN_PROFIT", "1000"))
    except ValueError:
        return 1000.0


def _get_account_profit(account: models.Account) -> float:
    equity = account.equity or 0.0
    initial = account.initial_balance or 0.0
    return equity - initial


def _account_to_dict(account: models.Account) -> Dict[str, Any]:
    profit = _get_account_profit(account)
    threshold = _get_withdrawal_threshold()
    return {
        "id": account.id,
        "user_id": account.user_id,
        "balance": account.balance,
        "equity": account.equity,
        "initial_balance": account.initial_balance,
        "daily_starting_equity": account.daily_starting_equity,
        "status": account.status,
        "challenge_type": account.challenge_type,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "profit": profit,
        "withdraw_min_profit": threshold,
        "withdraw_allowed": account.status == "funded" and profit >= threshold,
    }


def _position_to_dict(position: models.Position) -> Dict[str, Any]:
    return {
        "id": position.id,
        "account_id": position.account_id,
        "asset": position.asset,
        "quantity": position.quantity,
        "avg_entry_price": position.avg_entry_price,
        "created_at": position.created_at.isoformat() if position.created_at else None,
        "updated_at": position.updated_at.isoformat() if position.updated_at else None,
    }


def _profile_to_dict(user: models.User, profile: Optional[models.UserProfile]) -> Dict[str, Any]:
    return {
        "user_id": user.id,
        "full_name": profile.full_name if profile and profile.full_name else user.username,
        "email": user.email,
        "phone": profile.phone if profile else None,
        "country": profile.country if profile else None,
        "avatar_data": profile.avatar_data if profile else None,
        "preferred_language": profile.preferred_language if profile else "en",
        "dark_mode": bool(profile.dark_mode) if profile else True,
    }


def _user_challenge_to_dict(entry: models.UserChallenge, challenge: models.Challenge) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "challenge_id": entry.challenge_id,
        "challenge_name": challenge.name,
        "price_dh": challenge.price_dh,
        "initial_balance": challenge.initial_balance,
        "status": entry.status,
        "payment_method": entry.payment_method,
        "transaction_id": entry.transaction_id,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def _hash_password(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _activate_challenge(
    db: Session,
    user_id: int,
    challenge_id: int,
    payment_method: str,
    transaction_id: Optional[str] = None,
) -> Dict[str, Any]:
    challenge = db.query(models.Challenge).get(challenge_id)
    if challenge is None:
        return {"error": "Challenge not found"}

    user = db.query(models.User).get(user_id)
    if user is None:
        return {"error": "User not found"}

    new_user_challenge = models.UserChallenge(
        user_id=user_id,
        challenge_id=challenge_id,
        status="active",
        payment_method=payment_method,
        transaction_id=transaction_id,
    )
    db.add(new_user_challenge)

    new_account = models.Account(
        user_id=user_id,
        balance=challenge.initial_balance,
        equity=challenge.initial_balance,
        initial_balance=challenge.initial_balance,
        daily_starting_equity=challenge.initial_balance,
        challenge_type=challenge.name.lower(),
        status="active",
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return {"status": "success", "account_id": new_account.id}


@cache(ttl_seconds=int(os.environ.get("MARKET_PULSE_TTL", "8")))
async def get_market_pulse() -> Dict[str, Any]:
    assets = await market_overview_handler()
    movers = [a for a in assets if a.get("change_pct") is not None]
    movers.sort(key=lambda item: item.get("change_pct", 0), reverse=True)
    gainers = movers[:5]
    losers = list(reversed(movers[-5:]))
    return {
        "timestamp": int(time.time()),
        "gainers": gainers,
        "losers": losers,
    }


@router.get("/market-pulse")
async def market_pulse() -> Dict[str, Any]:
    return await get_market_pulse()


@cache(ttl_seconds=int(os.environ.get("BVC_CACHE_TTL", "10")))
async def get_casablanca_companies() -> Dict[str, Any]:
    return await asyncio.to_thread(get_casablanca_live_data)


@router.get("/casablanca/companies")
async def casablanca_companies(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    minimal: bool = False,
) -> Dict[str, Any]:
    result = await get_casablanca_companies()
    items = result.get("data", []) if isinstance(result, dict) else []

    total = len(items)
    items = items[offset:offset + limit]
    if minimal:
        items = [
            {
                "ticker": item.get("ticker"),
                "label": item.get("label"),
                "sector": item.get("sector"),
                "closing_price": item.get("closing_price"),
                "variation": item.get("variation"),
            }
            for item in items
        ]

    return {
        "status": result.get("status", "success"),
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@router.get("/casablanca/companies/search")
async def casablanca_companies_search(
    query: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    minimal: bool = False,
) -> Dict[str, Any]:
    result = await get_casablanca_companies()
    items = result.get("data", []) if isinstance(result, dict) else []

    needle = query.strip().lower()
    filtered = [
        item for item in items
        if needle in str(item.get("ticker", "")).lower()
        or needle in str(item.get("label", "")).lower()
        or needle in str(item.get("sector", "")).lower()
    ]

    total = len(filtered)
    filtered = filtered[offset:offset + limit]
    if minimal:
        filtered = [
            {
                "ticker": item.get("ticker"),
                "label": item.get("label"),
                "sector": item.get("sector"),
                "closing_price": item.get("closing_price"),
                "variation": item.get("variation"),
            }
            for item in filtered
        ]

    return {
        "status": result.get("status", "success"),
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": filtered,
    }

@router.get("/news")
def news() -> List[Dict[str, Any]]:
    return NewsService.get_latest()


@router.get("/ai/signals")
def ai_signals(
    account_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    require_funded_account(db, account_id)
    return AIService.generate_signals()


@router.get("/ai/predict/{symbol}")
def ai_predict(
    symbol: str,
    account_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    require_funded_account(db, account_id)
    prediction = AIService.get_prediction(symbol)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return prediction


@router.get("/accounts/{user_id}")
def accounts(user_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    accounts = db.query(models.Account).filter_by(user_id=user_id).all()
    return [_account_to_dict(account) for account in accounts]


@router.get("/portfolio/{user_id}")
def portfolio(user_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    account = db.query(models.Account).filter_by(user_id=user_id).first()
    if account is None:
        return {"account": None, "positions": [], "trades": []}

    positions = db.query(models.Position).filter_by(account_id=account.id).all()
    trades = db.query(models.Trade).filter_by(account_id=account.id).all()

    return {
        "account": _account_to_dict(account),
        "positions": [_position_to_dict(pos) for pos in positions],
        "trades": [
            {
                "id": trade.id,
                "account_id": trade.account_id,
                "asset": trade.asset,
                "type": trade.type,
                "entry_price": trade.entry_price,
                "exit_price": trade.exit_price,
                "quantity": trade.quantity,
                "take_profit": trade.take_profit,
                "stop_loss": trade.stop_loss,
                "profit": trade.profit,
                "status": trade.status,
                "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
            }
            for trade in trades
        ],
    }


@router.get("/user-challenges/{user_id}")
def user_challenges(user_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    rows = (
        db.query(models.UserChallenge, models.Challenge)
        .join(models.Challenge, models.UserChallenge.challenge_id == models.Challenge.id)
        .filter(models.UserChallenge.user_id == user_id)
        .order_by(models.UserChallenge.created_at.desc())
        .all()
    )
    return [_user_challenge_to_dict(entry, challenge) for entry, challenge in rows]


@router.get("/user-challenges/{user_id}/current")
def current_user_challenge(user_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    row = (
        db.query(models.UserChallenge, models.Challenge)
        .join(models.Challenge, models.UserChallenge.challenge_id == models.Challenge.id)
        .filter(models.UserChallenge.user_id == user_id)
        .order_by(models.UserChallenge.created_at.desc())
        .first()
    )
    if not row:
        return {"current": None}
    entry, challenge = row
    return {"current": _user_challenge_to_dict(entry, challenge)}


@router.get("/payments/{user_id}")
def payment_history(user_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    rows = (
        db.query(models.UserChallenge, models.Challenge)
        .join(models.Challenge, models.UserChallenge.challenge_id == models.Challenge.id)
        .filter(models.UserChallenge.user_id == user_id)
        .order_by(models.UserChallenge.created_at.desc())
        .all()
    )
    history = []
    for entry, challenge in rows:
        if entry.status in {"active", "funded"}:
            status = "completed"
        elif entry.status == "failed":
            status = "failed"
        else:
            status = "pending"
        history.append({
            "id": entry.transaction_id or f"TXN-{entry.id:03d}",
            "date": entry.created_at.isoformat() if entry.created_at else None,
            "description": f"{challenge.name} Challenge Purchase",
            "amount": challenge.price_dh,
            "status": status,
            "method": entry.payment_method,
        })
    return history


@router.post("/trade")
def execute_trade(payload: TradeRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    asset = payload.asset.strip()
    side = payload.side.strip().lower()
    if not asset:
        return {"error": "Missing asset symbol"}
    if side not in {"buy", "sell"}:
        return {"error": "Invalid side (use buy or sell)"}
    if payload.quantity <= 0:
        return {"error": "Quantity must be greater than 0"}
    if payload.price <= 0:
        return {"error": "Price must be greater than 0"}

    result = ChallengeEngine.process_trade(
        db,
        payload.account_id,
        asset,
        side,
        payload.quantity,
        payload.price,
        payload.market,
        payload.take_profit,
        payload.stop_loss,
    )

    if isinstance(result, dict) and result.get("error"):
        return result

    account = db.query(models.Account).get(payload.account_id)
    if account:
        ChallengeEngine.evaluate_account_celery(db, account)

    return result


@router.post("/withdrawals/request")
def request_withdrawal(payload: WithdrawalRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    account = db.query(models.Account).get(payload.account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status != "funded":
        raise HTTPException(status_code=403, detail="Withdrawals are only available for funded accounts")

    profit = _get_account_profit(account)
    threshold = _get_withdrawal_threshold()
    if profit < threshold:
        raise HTTPException(status_code=403, detail="Profit threshold not reached")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if payload.amount > profit:
        raise HTTPException(status_code=400, detail="Amount exceeds available profit")

    withdrawal = models.Withdrawal(
        account_id=account.id,
        amount=payload.amount,
        status="pending",
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)

    return {
        "status": "success",
        "account_id": account.id,
        "amount": payload.amount,
        "available_profit": profit,
        "min_profit": threshold,
        "withdrawal_id": withdrawal.id,
    }


@router.post("/pay")
def activate_challenge(payload: ChallengeActivationRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    activation = _activate_challenge(
        db,
        payload.user_id,
        payload.challenge_id,
        payment_method=payload.payment_method or "manual",
        transaction_id=payload.transaction_id,
    )
    if activation.get("error"):
        raise HTTPException(status_code=400, detail=activation["error"])
    return activation


@router.get("/profile/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = models.UserProfile(user_id=user_id, full_name=user.username)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return _profile_to_dict(user, profile)


@router.put("/profile/{user_id}")
def update_profile(
    user_id: int,
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = models.UserProfile(user_id=user_id)
        db.add(profile)

    user.username = payload.full_name
    user.email = payload.email
    profile.full_name = payload.full_name
    profile.phone = payload.phone
    profile.country = payload.country
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return _profile_to_dict(user, profile)


@router.post("/profile/{user_id}/avatar")
def update_avatar(
    user_id: int,
    payload: AvatarUpdateRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = models.UserProfile(user_id=user_id, full_name=user.username)
        db.add(profile)

    profile.avatar_data = payload.avatar_data
    db.commit()
    db.refresh(profile)
    return {"status": "success", "avatar_data": profile.avatar_data}


@router.post("/profile/{user_id}/password")
def update_password(
    user_id: int,
    payload: PasswordUpdateRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.password_hash:
        current_hash = _hash_password(payload.current_password)
        if current_hash != user.password_hash:
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    elif payload.current_password:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password_hash = _hash_password(payload.new_password)
    db.commit()
    return {"status": "success"}


@router.post("/profile/{user_id}/preferences")
def update_preferences(
    user_id: int,
    payload: PreferencesUpdateRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = models.UserProfile(user_id=user_id, full_name=user.username)
        db.add(profile)

    if payload.preferred_language is not None:
        profile.preferred_language = payload.preferred_language
    if payload.dark_mode is not None:
        profile.dark_mode = 1 if payload.dark_mode else 0
    db.commit()
    db.refresh(profile)
    return {"status": "success"}


@router.delete("/profile/{user_id}")
def delete_profile(user_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    accounts = db.query(models.Account).filter_by(user_id=user_id).all()
    account_ids = [account.id for account in accounts]
    if account_ids:
        db.query(models.Trade).filter(models.Trade.account_id.in_(account_ids)).delete(synchronize_session=False)
        db.query(models.Position).filter(models.Position.account_id.in_(account_ids)).delete(synchronize_session=False)
    db.query(models.Account).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(models.UserChallenge).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(models.UserProfile).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(models.User).filter_by(id=user_id).delete(synchronize_session=False)
    db.commit()
    return {"status": "deleted"}


@router.get("/bvc/overview")
async def bvc_overview() -> Dict[str, Any]:
    return await asyncio.to_thread(get_casablanca_live_data)


@router.get("/bvc/stream")
async def bvc_stream(interval: float = Query(5.0, ge=3.0, le=60.0)) -> StreamingResponse:
    async def event_stream():
        while True:
            data = await asyncio.to_thread(get_casablanca_live_data)
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(interval)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    accounts = db.query(models.Account).all()
    rows = []
    for account in accounts:
        user = db.query(models.User).get(account.user_id)
        if account.initial_balance and account.initial_balance > 0:
            profit_pct = ((account.equity - account.initial_balance) / account.initial_balance) * 100
        else:
            profit_pct = 0
        trades_count = db.query(models.Trade).filter_by(account_id=account.id).count()
        rows.append({
            "user_name": user.username if user else "Unknown",
            "profit_pct": round(profit_pct, 2),
            "status": account.status,
            "trades": trades_count,
        })
    rows.sort(key=lambda item: item["profit_pct"], reverse=True)
    return rows[:10]


@router.get("/admin/accounts")
def admin_accounts(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> List[Dict[str, Any]]:
    accounts = db.query(models.Account).all()
    result = []
    for account in accounts:
        user = db.query(models.User).get(account.user_id)
        profile = db.query(models.UserProfile).filter_by(user_id=account.user_id).first()
        result.append({
            "id": account.id,
            "user_id": account.user_id,
            "user_name": user.username if user else "Unknown",
            "user_email": user.email if user else None,
            "user_phone": profile.phone if profile else None,
            "user_country": profile.country if profile else None,
            "balance": account.balance,
            "equity": account.equity,
            "status": account.status,
            "challenge_type": account.challenge_type,
        })
    return result


@router.get("/admin/accounts/{account_id}/details")
def admin_account_details(
    account_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    account = db.query(models.Account).get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    user = db.query(models.User).get(account.user_id)
    profile = db.query(models.UserProfile).filter_by(user_id=account.user_id).first()
    trades = (
        db.query(models.Trade)
        .filter_by(account_id=account.id)
        .order_by(models.Trade.timestamp.desc())
        .limit(10)
        .all()
    )
    positions = db.query(models.Position).filter_by(account_id=account.id).all()

    return {
        "account": {
            "id": account.id,
            "balance": account.balance,
            "equity": account.equity,
            "initial_balance": account.initial_balance,
            "daily_starting_equity": account.daily_starting_equity,
            "status": account.status,
            "challenge_type": account.challenge_type,
            "created_at": account.created_at.isoformat() if account.created_at else None,
        },
        "user": {
            "id": user.id if user else None,
            "username": user.username if user else "Unknown",
            "email": user.email if user else None,
        },
        "profile": {
            "full_name": profile.full_name if profile else None,
            "phone": profile.phone if profile else None,
            "country": profile.country if profile else None,
            "preferred_language": profile.preferred_language if profile else "en",
            "dark_mode": bool(profile.dark_mode) if profile else True,
            "avatar_data": profile.avatar_data if profile else None,
        },
        "positions": [
            {
                "asset": position.asset,
                "quantity": position.quantity,
                "avg_entry_price": position.avg_entry_price,
            }
            for position in positions
        ],
        "trades": [
            {
                "id": trade.id,
                "asset": trade.asset,
                "type": trade.type,
                "entry_price": trade.entry_price,
                "quantity": trade.quantity,
                "take_profit": trade.take_profit,
                "stop_loss": trade.stop_loss,
                "profit": trade.profit,
                "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
            }
            for trade in trades
        ],
    }


@router.post("/admin/accounts/{account_id}/status")
def admin_update_status(
    account_id: int,
    payload: AdminStatusRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    account = db.query(models.Account).get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    account.status = payload.status
    db.add(models.AdminActionLog(action="account_status", details=f"Account {account_id} -> {account.status}"))
    db.commit()
    return {"message": f"Account {account_id} status updated to {account.status}"}


@router.put("/admin/accounts/{account_id}")
def admin_update_account(
    account_id: int,
    payload: AdminAccountUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    account = db.query(models.Account).get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if payload.balance is not None:
        account.balance = payload.balance
    if payload.equity is not None:
        account.equity = payload.equity
    if payload.status is not None:
        account.status = payload.status.lower()
    if payload.challenge_type is not None:
        account.challenge_type = payload.challenge_type.lower()
    if payload.initial_balance is not None:
        account.initial_balance = payload.initial_balance
    if payload.daily_starting_equity is not None:
        account.daily_starting_equity = payload.daily_starting_equity

    db.add(models.AdminActionLog(action="account_update", details=f"Account {account_id} updated"))
    db.commit()
    db.refresh(account)
    return _account_to_dict(account)


@router.delete("/admin/accounts/{account_id}")
def admin_delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    account = db.query(models.Account).get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    db.query(models.Trade).filter_by(account_id=account_id).delete(synchronize_session=False)
    db.query(models.Position).filter_by(account_id=account_id).delete(synchronize_session=False)
    db.delete(account)
    db.add(models.AdminActionLog(action="account_delete", details=f"Account {account_id} deleted"))
    db.commit()
    return {"status": "deleted"}


@router.put("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username is not None:
        user.username = payload.username
    if payload.email is not None:
        user.email = payload.email

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile and payload.username is not None:
        profile.full_name = payload.username

    db.add(models.AdminActionLog(action="user_update", details=f"User {user_id} updated"))
    db.commit()
    db.refresh(user)
    return {"status": "success", "user": {"id": user.id, "username": user.username, "email": user.email}}


@router.post("/admin/users/{user_id}/password")
def admin_reset_password(
    user_id: int,
    payload: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    user = db.query(models.User).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password_hash = _hash_password(payload.new_password)
    db.add(models.AdminActionLog(action="password_reset", details=f"Password reset for user {user_id}"))
    db.commit()
    return {"status": "success"}

@router.post("/contact")
def submit_contact_message(
    payload: ContactRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    name = (payload.name or "").strip()
    email = (payload.email or "").strip()
    subject = (payload.subject or "").strip()
    message = (payload.message or "").strip()
    if not name or not email or not message:
        raise HTTPException(status_code=400, detail="Name, email, and message are required")
    if len(name) > 120 or len(email) > 120 or len(subject) > 200 or len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long")

    entry = models.ContactMessage(
        name=name,
        email=email,
        subject=subject or None,
        message=message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"status": "received", "id": entry.id}

@router.get("/contact/replies")
def contact_replies(
    email: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    target_email = (email or "").strip().lower()
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        token_row = db.query(models.AuthToken).filter_by(token=token).first()
        if token_row:
            user = db.query(models.User).get(token_row.user_id)
            if user and user.email:
                target_email = user.email.lower().strip()
    if not target_email:
        raise HTTPException(status_code=400, detail="Email is required")
    messages = (
        db.query(models.ContactMessage)
        .filter(func.lower(models.ContactMessage.email) == target_email)
        .filter(models.ContactMessage.reply_message.isnot(None))
        .order_by(models.ContactMessage.replied_at.desc())
        .limit(50)
        .all()
    )
    return {
        "items": [
            {
                "id": msg.id,
                "subject": msg.subject,
                "message": msg.message,
                "reply_message": msg.reply_message,
                "replied_at": msg.replied_at.isoformat() if msg.replied_at else None,
                "replied_by": msg.replied_by,
            }
            for msg in messages
        ]
    }

@router.get("/admin/contacts")
def admin_contact_messages(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    query = db.query(models.ContactMessage)
    if status:
        query = query.filter(models.ContactMessage.status == status.lower())
    messages = (
        query.order_by(models.ContactMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": msg.id,
                "name": msg.name,
                "email": msg.email,
                "subject": msg.subject,
                "message": msg.message,
                "reply_message": msg.reply_message,
                "replied_by": msg.replied_by,
                "replied_at": msg.replied_at.isoformat() if msg.replied_at else None,
                "status": msg.status,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg in messages
        ],
        "limit": limit,
        "offset": offset,
        "total": len(messages),
    }

@router.post("/admin/contacts/{message_id}/reply")
def admin_reply_contact_message(
    message_id: int,
    payload: ContactReplyRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    message = db.query(models.ContactMessage).get(message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    reply_text = (payload.reply or "").strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="Reply is required")
    if len(reply_text) > 2000:
        raise HTTPException(status_code=400, detail="Reply is too long")
    message.reply_message = reply_text
    message.replied_by = admin_user.email
    message.replied_at = datetime.utcnow()
    message.status = (payload.status or "replied").lower().strip()
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "status": "sent",
        "id": message.id,
        "replied_at": message.replied_at.isoformat() if message.replied_at else None,
    }

@router.get("/admin/logs")
def admin_logs(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> List[Dict[str, Any]]:
    logs = db.query(models.AdminActionLog).order_by(models.AdminActionLog.created_at.desc()).limit(20).all()
    return [
        {
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/admin/analytics")
def admin_analytics(
    range: str = Query("7d"),
    challenge_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    start, end = _resolve_range(range, date_from, date_to)
    accounts_query = db.query(models.Account)
    if challenge_type:
        accounts_query = accounts_query.filter(func.lower(models.Account.challenge_type) == challenge_type.lower())
    if status:
        accounts_query = accounts_query.filter(models.Account.status == status.lower())
    if start:
        accounts_query = accounts_query.filter(models.Account.created_at >= start)
    if end:
        accounts_query = accounts_query.filter(models.Account.created_at <= end)
    accounts = accounts_query.all()
    account_ids = [account.id for account in accounts]

    total_accounts = len(accounts)
    funded_count = len([a for a in accounts if a.status == "funded"])
    failed_count = len([a for a in accounts if a.status == "failed"])
    active_count = len([a for a in accounts if a.status == "active"])
    profit_total = sum((a.equity or 0) - (a.initial_balance or 0) for a in accounts)
    funded_pct = round((funded_count / total_accounts) * 100) if total_accounts else 0
    failed_pct = round((failed_count / total_accounts) * 100) if total_accounts else 0

    pnl_series = []
    if account_ids and start and end:
        daily = (
            db.query(func.date(models.Trade.timestamp).label("day"), func.sum(models.Trade.profit).label("pnl"))
            .filter(models.Trade.account_id.in_(account_ids))
            .filter(models.Trade.timestamp >= start)
            .filter(models.Trade.timestamp <= end)
            .group_by("day")
            .order_by("day")
            .all()
        )
        pnl_map = {str(row.day): float(row.pnl or 0) for row in daily}
        for day in _date_range_days(start, end):
            pnl_series.append({"label": day, "value": round(pnl_map.get(day, 0), 2)})
    elif start and end:
        pnl_series = [{"label": day, "value": 0} for day in _date_range_days(start, end)]

    challenge_breakdown = []
    for tier in ["starter", "pro", "elite", "demo"]:
        count = len([a for a in accounts if (a.challenge_type or "").lower() == tier])
        challenge_breakdown.append({"name": tier.upper(), "value": count})

    status_breakdown = [
        {"name": "Funded", "value": funded_count},
        {"name": "Active", "value": active_count},
        {"name": "Failed", "value": failed_count},
    ]

    withdrawal_breakdown = {"pending": 0, "approved": 0, "rejected": 0, "paid": 0}
    if account_ids:
        withdrawals_query = db.query(models.Withdrawal).filter(models.Withdrawal.account_id.in_(account_ids))
        if start:
            withdrawals_query = withdrawals_query.filter(models.Withdrawal.created_at >= start)
        if end:
            withdrawals_query = withdrawals_query.filter(models.Withdrawal.created_at <= end)
        withdrawals = withdrawals_query.all()
        for w in withdrawals:
            key = (w.status or "pending").lower()
            if key in withdrawal_breakdown:
                withdrawal_breakdown[key] += 1

    equity_series = []
    if end:
        for week_start, week_end, label in _date_range_weeks(end):
            count = len([a for a in accounts if a.created_at and week_start <= a.created_at <= week_end])
            equity_series.append({"label": label, "value": count})

    return {
        "kpis": {
            "total_accounts": total_accounts,
            "funded_count": funded_count,
            "failed_count": failed_count,
            "active_count": active_count,
            "funded_pct": funded_pct,
            "failed_pct": failed_pct,
            "profit_total": round(profit_total, 2),
        },
        "series": {
            "pnl": pnl_series,
            "status": status_breakdown,
            "challenge": challenge_breakdown,
            "withdrawals": [
                {"name": "Pending", "value": withdrawal_breakdown["pending"]},
                {"name": "Approved", "value": withdrawal_breakdown["approved"]},
                {"name": "Paid", "value": withdrawal_breakdown["paid"]},
                {"name": "Rejected", "value": withdrawal_breakdown["rejected"]},
            ],
            "growth": equity_series,
        },
        "filters": {
            "range": range,
            "date_from": start.isoformat() if start else None,
            "date_to": end.isoformat() if end else None,
            "challenge_type": challenge_type,
            "status": status,
        },
    }


@router.get("/admin/withdrawals")
def admin_withdrawals(
    status: Optional[str] = Query(None),
    account_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    start = _parse_date(date_from)
    end = _parse_date(date_to)
    query = db.query(models.Withdrawal)
    if status:
        query = query.filter(models.Withdrawal.status == status.lower())
    if account_id:
        query = query.filter(models.Withdrawal.account_id == account_id)
    if start:
        query = query.filter(models.Withdrawal.created_at >= start)
    if end:
        query = query.filter(models.Withdrawal.created_at <= end)

    withdrawals = query.order_by(models.Withdrawal.created_at.desc()).offset(offset).limit(limit).all()
    rows = []
    for w in withdrawals:
        account = db.query(models.Account).get(w.account_id)
        user = db.query(models.User).get(account.user_id) if account else None
        if user_id and user and user.id != user_id:
            continue
        rows.append({
            "id": w.id,
            "account_id": w.account_id,
            "user_id": user.id if user else None,
            "user_email": user.email if user else None,
            "user_name": user.username if user else None,
            "amount": w.amount,
            "status": w.status,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "processed_at": w.processed_at.isoformat() if w.processed_at else None,
        })

    return {
        "items": rows,
        "limit": limit,
        "offset": offset,
        "total": len(rows),
    }


@router.post("/admin/withdrawals/{withdrawal_id}/status")
def admin_update_withdrawal(
    withdrawal_id: int,
    payload: WithdrawalStatusRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    withdrawal = db.query(models.Withdrawal).get(withdrawal_id)
    if withdrawal is None:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    status_value = (payload.status or "").lower().strip()
    if status_value not in {"pending", "approved", "rejected", "paid"}:
        raise HTTPException(status_code=400, detail="Invalid withdrawal status")

    withdrawal.status = status_value
    if status_value in {"approved", "rejected", "paid"}:
        withdrawal.processed_at = datetime.utcnow()
    db.add(models.AdminActionLog(action="withdrawal_update", details=f"Withdrawal {withdrawal_id} -> {status_value}"))
    db.commit()
    db.refresh(withdrawal)

    return {
        "status": "success",
        "withdrawal": {
            "id": withdrawal.id,
            "account_id": withdrawal.account_id,
            "amount": withdrawal.amount,
            "status": withdrawal.status,
            "created_at": withdrawal.created_at.isoformat() if withdrawal.created_at else None,
            "processed_at": withdrawal.processed_at.isoformat() if withdrawal.processed_at else None,
        },
    }


@router.post("/paypal/config")
def paypal_config(
    payload: PayPalConfigRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    if not payload.client_id or not payload.client_secret:
        raise HTTPException(status_code=400, detail="Missing PayPal credentials")
    db.query(models.PayPalConfig).delete()
    config = models.PayPalConfig(
        client_id=payload.client_id,
        client_secret=payload.client_secret,
        mode=payload.mode,
        currency_code=payload.currency_code,
    )
    db.add(config)
    db.add(models.AdminActionLog(action="paypal_config", details=f"PayPal mode={payload.mode} currency={payload.currency_code}"))
    db.commit()
    return {"status": "saved"}


@router.get("/paypal/config/public")
def paypal_public_config(db: Session = Depends(get_db)) -> Dict[str, Any]:
    config = db.query(models.PayPalConfig).order_by(models.PayPalConfig.created_at.desc()).first()
    if not config:
        raise HTTPException(status_code=404, detail="PayPal not configured")
    return {"client_id": config.client_id, "currency_code": config.currency_code}


@router.post("/paypal/create-order")
def paypal_create_order(payload: PayPalOrderRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if requests is None:
        raise HTTPException(status_code=500, detail="requests is not installed")
    challenge = db.query(models.Challenge).get(payload.challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    config = db.query(models.PayPalConfig).order_by(models.PayPalConfig.created_at.desc()).first()
    if config is None:
        raise HTTPException(status_code=400, detail="PayPal not configured")

    base_url = "https://api-m.sandbox.paypal.com" if config.mode == "sandbox" else "https://api-m.paypal.com"
    auth = base64.b64encode(f"{config.client_id}:{config.client_secret}".encode()).decode()
    token_res = requests.post(
        f"{base_url}/v1/oauth2/token",
        headers={"Authorization": f"Basic {auth}"},
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get PayPal token")
    access_token = token_res.json().get("access_token")

    order_res = requests.post(
        f"{base_url}/v2/checkout/orders",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        json={
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": str(payload.challenge_id),
                    "amount": {
                        "currency_code": config.currency_code,
                        "value": str(challenge.price_dh),
                    },
                }
            ],
        },
        timeout=10,
    )
    if order_res.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail="Failed to create PayPal order")
    return order_res.json()


@router.post("/paypal/capture-order")
def paypal_capture_order(payload: PayPalCaptureRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if requests is None:
        raise HTTPException(status_code=500, detail="requests is not installed")

    config = db.query(models.PayPalConfig).order_by(models.PayPalConfig.created_at.desc()).first()
    if config is None:
        raise HTTPException(status_code=400, detail="PayPal not configured")

    base_url = "https://api-m.sandbox.paypal.com" if config.mode == "sandbox" else "https://api-m.paypal.com"
    auth = base64.b64encode(f"{config.client_id}:{config.client_secret}".encode()).decode()
    token_res = requests.post(
        f"{base_url}/v1/oauth2/token",
        headers={"Authorization": f"Basic {auth}"},
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get PayPal token")
    access_token = token_res.json().get("access_token")

    capture_res = requests.post(
        f"{base_url}/v2/checkout/orders/{payload.order_id}/capture",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        timeout=10,
    )
    if capture_res.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail="Failed to capture PayPal order")

    activation = _activate_challenge(
        db,
        payload.user_id,
        payload.challenge_id,
        payment_method="paypal",
        transaction_id=payload.order_id,
    )
    if activation.get("error"):
        raise HTTPException(status_code=400, detail=activation["error"])
    activation["paypal"] = capture_res.json()
    return activation


@router.post("/cmi/generate-form")
def cmi_generate_form(payload: CMIRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    config = db.query(models.CMIConfig).order_by(models.CMIConfig.created_at.desc()).first()
    if config is None:
        raise HTTPException(status_code=400, detail="CMI not configured")

    challenge = db.query(models.Challenge).get(payload.challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    user = db.query(models.User).get(payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    urls = _get_cmi_urls()
    buyer_email = (user.email or "").strip() or os.environ.get("CMI_DEFAULT_EMAIL", "trader@tradesense.ai")
    fields = {
        "clientid": config.store_id,
        "amount": str(challenge.price_dh),
        "currency": "504",
        "oid": f"TS-{int(time.time())}-{payload.user_id}-{payload.challenge_id}",
        "okUrl": urls["ok_url"],
        "failUrl": urls["fail_url"],
        "lang": "fr",
        "email": buyer_email,
        "hashAlgorithm": "ver3",
        "shopurl": urls["shop_url"],
        "callbackUrl": urls["callback_url"],
        "encoding": "UTF-8",
    }

    sorted_keys = sorted(fields.keys())
    hash_str = "|".join([str(fields[k]) for k in sorted_keys]) + "|" + config.shared_secret
    fields["HASH"] = hashlib.sha512(hash_str.encode("utf-8")).hexdigest().upper()

    action_url = "https://test.cmi.ma/fim/est3Dgate" if config.mode == "test" else "https://payment.cmi.ma/fim/est3Dgate"
    return {"action": action_url, "fields": fields}


@router.post("/cmi/callback")
async def cmi_callback(request: Request, db: Session = Depends(get_db)) -> PlainTextResponse:
    form_data = await request.form()
    oid = form_data.get("oid") or form_data.get("OID")
    response = form_data.get("Response") or form_data.get("response")

    if response == "Approved" and oid:
        parts = str(oid).split("-")
        if len(parts) >= 4:
            try:
                user_id = int(parts[2])
                challenge_id = int(parts[3])
            except ValueError:
                user_id = None
                challenge_id = None
            if user_id and challenge_id:
                _activate_challenge(
                    db,
                    user_id,
                    challenge_id,
                    payment_method="cmi",
                    transaction_id=str(oid),
                )

    return PlainTextResponse("ACTION=POSTAUTH", status_code=200)


@router.post("/cmi/config")
def cmi_config(
    payload: CMIConfigRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    if not payload.store_id or not payload.shared_secret:
        raise HTTPException(status_code=400, detail="Missing CMI credentials")

    db.query(models.CMIConfig).delete()
    config = models.CMIConfig(
        store_id=payload.store_id,
        shared_secret=payload.shared_secret,
        mode=payload.mode,
    )
    db.add(config)
    db.add(models.AdminActionLog(action="cmi_config", details=f"CMI mode={payload.mode}"))
    db.commit()
    return {"status": "saved"}


@router.post("/crypto/create-order")
def crypto_create_order(payload: CryptoOrderRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if requests is None:
        raise HTTPException(status_code=500, detail="requests is not installed")

    config = db.query(models.CryptoConfig).order_by(models.CryptoConfig.created_at.desc()).first()
    if config is None:
        raise HTTPException(status_code=400, detail="Binance Pay not configured")

    challenge = db.query(models.Challenge).get(payload.challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    endpoint = "/binancepay/openapi/v2/order"
    base_url = "https://bpay.binanceapi.com"

    nonce = str(int(time.time() * 1000))
    timestamp = str(int(time.time() * 1000))
    body = {
        "env": {"terminalType": "WEB"},
        "merchantTradeNo": f"TS-{int(time.time())}-{payload.user_id}",
        "orderAmount": challenge.price_dh,
        "currency": "USDT",
        "goods": {
            "goodsType": "02",
            "goodsCategory": "6000",
            "referenceGoodsId": challenge.name,
            "goodsName": challenge.name,
        },
        "cancelUrl": "http://localhost:8080/checkout",
        "returnUrl": "http://localhost:8080/dashboard/challenge?mode=paid",
    }

    json_body = json.dumps(body)
    payload_str = f"{timestamp}\n{nonce}\n{json_body}\n"
    signature = hmac.new(
        config.api_secret.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest().upper()

    headers = {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": config.api_key,
        "BinancePay-Signature": signature,
    }

    res = requests.post(f"{base_url}{endpoint}", headers=headers, data=json_body, timeout=10)
    return res.json()


@router.post("/crypto/config")
def crypto_config(
    payload: CryptoConfigRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    if not payload.api_key or not payload.api_secret:
        raise HTTPException(status_code=400, detail="Missing Binance Pay credentials")

    db.query(models.CryptoConfig).delete()
    config = models.CryptoConfig(
        api_key=payload.api_key,
        api_secret=payload.api_secret,
        merchant_id=payload.merchant_id,
    )
    db.add(config)
    db.add(models.AdminActionLog(action="crypto_config", details="Binance Pay config updated"))
    db.commit()
    return {"status": "saved"}
