from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(128))
    is_admin = Column(Integer, default=0)
    accounts = relationship('Account', back_populates='owner')
    profile = relationship('UserProfile', back_populates='user', uselist=False)

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    balance = Column(Float, default=5000.0)
    equity = Column(Float, default=5000.0)
    initial_balance = Column(Float, default=5000.0)
    daily_starting_equity = Column(Float, default=5000.0)
    status = Column(String(20), default='active')  # active, failed, funded
    challenge_type = Column(String(50))  # starter, pro, elite
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship('User', back_populates='accounts')
    trades = relationship('Trade', back_populates='account')
    positions = relationship('Position', back_populates='account')
    withdrawals = relationship('Withdrawal', back_populates='account')

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey('accounts.id'), nullable=False)
    asset = Column(String(20), nullable=False)
    type = Column(String(10), nullable=False)  # buy, sell
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float)
    quantity = Column(Float, nullable=False)
    take_profit = Column(Float)
    stop_loss = Column(Float)
    profit = Column(Float, default=0.0)
    status = Column(String(20), default='open')  # open, closed
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    account = relationship('Account', back_populates='trades')

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey('accounts.id'), nullable=False)
    asset = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    avg_entry_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship('Account', back_populates='positions')

class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    price_dh = Column(Float, nullable=False)
    initial_balance = Column(Float, nullable=False)
    profit_target_pct = Column(Float, default=10.0)
    max_daily_loss_pct = Column(Float, default=5.0)
    max_total_loss_pct = Column(Float, default=10.0)

class UserChallenge(Base):
    __tablename__ = "user_challenges"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    challenge_id = Column(Integer, ForeignKey('challenges.id'), nullable=False)
    status = Column(String(20), default='active')  # active, failed, funded
    payment_method = Column(String(20), nullable=False)
    transaction_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class PayPalConfig(Base):
    __tablename__ = "paypal_configs"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(255), nullable=False)
    client_secret = Column(String(255), nullable=False)
    mode = Column(String(20), default='sandbox')  # sandbox, live
    currency_code = Column(String(10), default='USD')
    created_at = Column(DateTime, default=datetime.utcnow)

class AdminActionLog(Base):
    __tablename__ = "admin_action_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False)
    details = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

class AuthToken(Base):
    __tablename__ = "auth_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token = Column(String(128), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CMIConfig(Base):
    __tablename__ = "cmi_configs"
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), nullable=False)
    shared_secret = Column(String(255), nullable=False)
    mode = Column(String(20), default='test') # test, live
    created_at = Column(DateTime, default=datetime.utcnow)

class CryptoConfig(Base):
    __tablename__ = "crypto_configs"
    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String(255), nullable=False)
    api_secret = Column(String(255), nullable=False)
    merchant_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey('accounts.id'), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(20), default='pending')  # pending, approved, rejected, paid
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)

    account = relationship('Account', back_populates='withdrawals')


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    full_name = Column(String(120))
    phone = Column(String(40))
    country = Column(String(80))
    avatar_data = Column(String)
    preferred_language = Column(String(10), default='en')
    dark_mode = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', back_populates='profile')


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(120), nullable=False)
    subject = Column(String(200))
    message = Column(String, nullable=False)
    reply_message = Column(String)
    replied_by = Column(String(120))
    replied_at = Column(DateTime)
    status = Column(String(20), default='new')
    created_at = Column(DateTime, default=datetime.utcnow)
