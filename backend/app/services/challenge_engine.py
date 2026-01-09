from datetime import datetime

try:
    from ..db import models
except ImportError:  # Fallback for legacy/Flask usage
    import models

class ChallengeEngine:
    @staticmethod
    def evaluate_all_active_accounts_celery(db_session):
        """
        Evaluates all active accounts using a passed SQLAlchemy session.
        This is designed to be called from a Celery task.
        """
        accounts = db_session.query(models.Account).filter_by(status='active').all()
        for account in accounts:
            ChallengeEngine.evaluate_account_celery(db_session, account)
        print(f"Evaluated {len(accounts)} active accounts.")

    @staticmethod
    def evaluate_account_celery(db_session, account):
        """
        Checks if a single account has failed or passed, using a passed session.
        """
        if not account or account.status != 'active':
            return
        if account.challenge_type == 'demo':
            return

        # 1. Total Max Loss Check (10%)
        total_loss_limit = account.initial_balance * 0.10
        if (account.initial_balance - account.equity) >= total_loss_limit:
            account.status = 'failed'
            db_session.commit()
            return

        # 2. Daily Max Loss Check (5%)
        daily_loss_limit = account.daily_starting_equity * 0.05
        if (account.daily_starting_equity - account.equity) >= daily_loss_limit:
            account.status = 'failed'
            db_session.commit()
            return

        # 3. Profit Target Check (10%)
        profit_target = account.initial_balance * 0.10
        if (account.equity - account.initial_balance) >= profit_target:
            account.status = 'funded'
            db_session.commit()
            return

    @staticmethod
    def process_trade(db_session, account_id, asset, side, quantity, price, market=None, take_profit=None, stop_loss=None):
        """
        Execute a trade and update account equity, using a passed SQLAlchemy session.
        """
        account = db_session.query(models.Account).get(account_id)
        if not account:
            return {"error": "Account not found"}
        if account.challenge_type != 'demo' and account.status not in {'active', 'funded'}:
            return {"error": "Account not active or not found"}
        if account.challenge_type == 'demo' and account.status != 'active':
            account.status = 'active'
        if quantity <= 0 or price <= 0:
            return {"error": "Invalid trade quantity or price"}

        # Reset daily starting equity when a new trading day begins.
        last_trade = db_session.query(models.Trade).filter_by(account_id=account_id).order_by(models.Trade.timestamp.desc()).first()
        if last_trade and last_trade.timestamp.date() != datetime.utcnow().date():
            account.daily_starting_equity = account.equity

        position = db_session.query(models.Position).filter_by(account_id=account_id, asset=asset).first()
        realized_profit = 0.0
        trade_value = round(price * quantity, 2)
        allow_short = True

        if side == 'buy':
            if account.balance < trade_value:
                return {"error": "Insufficient balance"}
            if position and position.quantity < 0:
                cover_qty = min(quantity, abs(position.quantity))
                realized_profit = round((position.avg_entry_price - price) * cover_qty, 2)
                position.quantity = position.quantity + cover_qty
                account.balance = round(account.balance - round(price * cover_qty, 2), 2)
                remaining_qty = quantity - cover_qty
                if position.quantity == 0:
                    db_session.delete(position)
                    position = None
                if remaining_qty > 0:
                    position = models.Position(
                        account_id=account_id,
                        asset=asset,
                        quantity=remaining_qty,
                        avg_entry_price=price
                    )
                    db_session.add(position)
                    account.balance = round(account.balance - round(price * remaining_qty, 2), 2)
            else:
                if position:
                    new_qty = position.quantity + quantity
                    position.avg_entry_price = ((position.avg_entry_price * position.quantity) + (price * quantity)) / new_qty
                    position.quantity = new_qty
                else:
                    position = models.Position(
                        account_id=account_id,
                        asset=asset,
                        quantity=quantity,
                        avg_entry_price=price
                    )
                    db_session.add(position)
                account.balance = round(account.balance - trade_value, 2)
        else:  # Sell
            if position and position.quantity > 0:
                sell_qty = min(quantity, position.quantity)
                realized_profit = round((price - position.avg_entry_price) * sell_qty, 2)
                position.quantity = position.quantity - sell_qty
                if position.quantity <= 0:
                    db_session.delete(position)
                account.balance = round(account.balance + round(price * sell_qty, 2), 2)
            else:
                if not allow_short:
                    return {"error": "No open position to sell"}
                if position and position.quantity < 0:
                    new_qty = position.quantity - quantity
                    position.avg_entry_price = ((abs(position.quantity) * position.avg_entry_price) + (price * quantity)) / abs(new_qty)
                    position.quantity = new_qty
                else:
                    position = models.Position(
                        account_id=account_id,
                        asset=asset,
                        quantity=-quantity,
                        avg_entry_price=price
                    )
                    db_session.add(position)
                account.balance = round(account.balance + trade_value, 2)

        new_trade = models.Trade(
            account_id=account_id,
            asset=asset,
            type=side,
            entry_price=price,
            exit_price=price if side == 'sell' else None,
            quantity=quantity,
            take_profit=take_profit,
            stop_loss=stop_loss,
            profit=realized_profit,
            status='closed'
        )
        db_session.add(new_trade)

        positions = db_session.query(models.Position).filter_by(account_id=account_id).all()
        positions_value = sum([p.quantity * p.avg_entry_price for p in positions]) if positions else 0.0
        account.equity = round(account.balance + positions_value, 2)
        db_session.commit()

        return {"status": "Trade recorded", "trade_id": new_trade.id, "profit": realized_profit, "equity": account.equity}
