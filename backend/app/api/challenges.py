from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..db import models, schemas
from ..db.database import get_db

router = APIRouter(
    prefix="/api",
    tags=["Challenges"]
)

@router.get("/challenges", response_model=List[schemas.Challenge])
def get_challenges(db: Session = Depends(get_db)):
    challenges = db.query(models.Challenge).all()
    return challenges
