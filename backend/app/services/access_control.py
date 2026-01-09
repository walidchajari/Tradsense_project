from fastapi import HTTPException

from ..db import models


def require_funded_account(db, account_id: int):
    if account_id is None:
        raise HTTPException(status_code=400, detail="account_id is required")

    account = db.query(models.Account).get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.status != "funded":
        raise HTTPException(status_code=403, detail="Funded account required")

    return account
