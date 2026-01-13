from typing import Dict, Optional
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db import models
from ..services.auth import hash_password, verify_password, create_access_token

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
except Exception:
    google_id_token = None
    google_requests = None


router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger("tradesense.auth")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    account_type: Optional[str] = None
    plan: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    account_type: Optional[str] = None
    plan: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    username: str
    is_admin: bool


def _read_env_file_ids() -> list[str]:
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    if not os.path.exists(env_path):
        return []
    ids: list[str] = []
    try:
        with open(env_path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key == "GOOGLE_CLIENT_IDS":
                    ids.extend([item.strip() for item in value.split(",") if item.strip()])
                if key == "GOOGLE_CLIENT_ID" and value.strip():
                    ids.append(value.strip())
    except Exception:
        return []
    return ids


def _get_google_client_ids() -> list[str]:
    raw_ids = os.environ.get("GOOGLE_CLIENT_IDS", "")
    ids = [item.strip() for item in raw_ids.split(",") if item.strip()]
    single = os.environ.get("GOOGLE_CLIENT_ID")
    if single:
        ids.append(single.strip())
    ids.extend(_read_env_file_ids())
    if not ids:
        ids = [
            "132353474250-lb2mb6ecm3k0ot4voi7j7366arbdnj81.apps.googleusercontent.com",
            "132353474250-bd8ukm2jei3mns3278ti7gak0tooednd.apps.googleusercontent.com",
        ]
    return list(dict.fromkeys(ids))


def _find_unique_username(db: Session, base: str) -> str:
    base = (base or "user").strip() or "user"
    username = base
    suffix = 1
    while db.query(models.User).filter_by(username=username).first() is not None:
        suffix += 1
        username = f"{base}{suffix}"
    return username


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    if "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(models.User).filter_by(email=payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        username=payload.username.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    account_type = (payload.account_type or "").lower().strip()
    plan = (payload.plan or "").lower().strip()
    if account_type in {"demo", "trial", "paid"}:
        balance = 0.0
        status = "active"
        challenge_type = account_type
        if account_type == "demo":
            balance = 10000.0
        elif account_type == "trial":
            balance = 2000.0
        else:
            challenge = db.query(models.Challenge).filter(
                models.Challenge.name.ilike(plan or "")
            ).first()
            if challenge:
                balance = challenge.initial_balance
                challenge_type = challenge.name.lower()
            status = "pending"

        new_account = models.Account(
            user_id=user.id,
            balance=balance,
            equity=balance,
            initial_balance=balance,
            daily_starting_equity=balance,
            challenge_type=challenge_type,
            status=status,
        )
        db.add(new_account)
        db.commit()

    token = create_access_token(str(user.id))
    db.add(models.AuthToken(user_id=user.id, token=token))
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "is_admin": bool(user.is_admin),
    }


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    if "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    user = db.query(models.User).filter_by(email=payload.email.lower().strip()).first()
    if user is None or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    db.add(models.AuthToken(user_id=user.id, token=token))
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "is_admin": bool(user.is_admin),
    }


@router.post("/google", response_model=AuthResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    if google_id_token is None or google_requests is None:
        raise HTTPException(status_code=500, detail="Google auth libraries are not installed")

    request = google_requests.Request()
    allowed = _get_google_client_ids()
    if not allowed:
        logger.warning("Google auth: no GOOGLE_CLIENT_ID(S) configured")
    try:
        idinfo = None
        last_error = None
        for aud in allowed:
            try:
                try:
                    idinfo = google_id_token.verify_oauth2_token(
                        payload.id_token,
                        request,
                        aud,
                        clock_skew_in_seconds=300,
                    )
                except TypeError:
                    idinfo = google_id_token.verify_oauth2_token(payload.id_token, request, aud)
                break
            except Exception as exc:
                last_error = exc
        if idinfo is None:
            raise last_error or Exception("Invalid Google token")
    except Exception:
        logger.warning("Google auth: token verification failed", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid Google token")

    if idinfo.get("aud") not in allowed:
        logger.warning("Google auth: audience mismatch aud=%s allowed=%s", idinfo.get("aud"), allowed)
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    if idinfo.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        logger.warning("Google auth: invalid issuer iss=%s", idinfo.get("iss"))
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")
    if not idinfo.get("email_verified", False):
        logger.warning("Google auth: email not verified email=%s", idinfo.get("email"))
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    email = idinfo.get("email")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Google account email is missing")

    user = db.query(models.User).filter_by(email=email.lower().strip()).first()
    if user is None:
        name = idinfo.get("name") or email.split("@", 1)[0]
        username = _find_unique_username(db, name.replace(" ", "").lower())
        user = models.User(
            username=username,
            email=email.lower().strip(),
            password_hash=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        account_type = (payload.account_type or "").lower().strip()
        plan = (payload.plan or "").lower().strip()
        if account_type in {"demo", "trial", "paid"}:
            balance = 0.0
            status = "active"
            challenge_type = account_type
            if account_type == "demo":
                balance = 10000.0
            elif account_type == "trial":
                balance = 2000.0
            else:
                challenge = db.query(models.Challenge).filter(
                    models.Challenge.name.ilike(plan or "")
                ).first()
                if challenge:
                    balance = challenge.initial_balance
                    challenge_type = challenge.name.lower()
                status = "pending"

            new_account = models.Account(
                user_id=user.id,
                balance=balance,
                equity=balance,
                initial_balance=balance,
                daily_starting_equity=balance,
                challenge_type=challenge_type,
                status=status,
            )
            db.add(new_account)
            db.commit()

    token = create_access_token(str(user.id))
    db.add(models.AuthToken(user_id=user.id, token=token))
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "is_admin": bool(user.is_admin),
    }
