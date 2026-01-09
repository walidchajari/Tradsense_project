from pydantic import BaseModel

class ChallengeBase(BaseModel):
    name: str
    price_dh: float
    initial_balance: float
    profit_target_pct: float
    max_daily_loss_pct: float
    max_total_loss_pct: float

class Challenge(ChallengeBase):
    id: int

    class Config:
        orm_mode = True
