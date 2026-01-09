from flask import request, jsonify, Response, stream_with_context
from flask_restful import Resource
from extensions import db, api
# Removed app import to avoid circular dependency
from models import User, Account, Trade, Challenge, UserChallenge, PayPalConfig, Position, AdminActionLog, CMIConfig
from services.market_data import MarketDataService
from services.challenge_engine import ChallengeEngine
from services.ai_service import AIService
from services.news_service import NewsService
from services.payment_service import PaymentService
from services.market_scraper_casablanca import scrape_casablanca_live_overview
import base64
import json
import time

try:
    import requests
except Exception:
    requests = None

def activate_challenge(user_id, challenge_id, payment_method):
    challenge = Challenge.query.get(challenge_id)
    if not challenge:
        return None, {"error": "Challenge not found"}

    new_user_challenge = UserChallenge(
        user_id=user_id,
        challenge_id=challenge_id,
        status='active',
        payment_method=payment_method
    )
    db.session.add(new_user_challenge)

    new_account = Account(
        user_id=user_id,
        balance=challenge.initial_balance,
        equity=challenge.initial_balance,
        initial_balance=challenge.initial_balance,
        daily_starting_equity=challenge.initial_balance,
        challenge_type=challenge.name.lower(),
        status='active'
    )
    db.session.add(new_account)
    db.session.commit()
    return new_account, {"status": "success", "account_id": new_account.id}

class MarketDataCasablancaResource(Resource):
    def get(self):
        data = scrape_casablanca_live_overview()
        return jsonify(data)

class BVCOverviewResource(Resource):
    def get(self):
        data = scrape_casablanca_live_overview()
        return jsonify(data)

class BVCStreamResource(Resource):
    def get(self):
        try:
            interval = float(request.args.get("interval", "5"))
        except Exception:
            interval = 5.0
        interval = min(max(interval, 3.0), 60.0)

        def event_stream():
            while True:
                data = scrape_casablanca_live_overview()
                yield f"data: {json.dumps(data)}\n\n"
                time.sleep(interval)

        return Response(
            stream_with_context(event_stream()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

class MarketDataResource(Resource):
    def get(self):
        tickers = request.args.get('tickers', 'BTC-USD,AAPL,IAM').split(',')
        prices = MarketDataService.get_all_prices(tickers)
        return jsonify(prices)

class MarketOverviewResource(Resource):
    def get(self):
        assets = MarketDataService.get_market_universe_cached()
        return jsonify(assets)

class MarketHistoryResource(Resource):
    def get(self):
        symbols = request.args.get('symbols', '')
        points = int(request.args.get('points', 20))
        symbols = [s for s in symbols.split(',') if s]
        symbols = symbols[:50]
        points = min(max(points, 5), 40)
        history = MarketDataService.get_history_cached(symbols, points)
        return jsonify(history)

class ChallengeList(Resource):
    def get(self):
        challenges = Challenge.query.all()
        return jsonify([{
            "id": c.id,
            "name": c.name,
            "price_dh": c.price_dh,
            "initial_balance": c.initial_balance,
            "profit_target_pct": c.profit_target_pct,
            "max_daily_loss_pct": c.max_daily_loss_pct,
            "max_total_loss_pct": c.max_total_loss_pct
        } for c in challenges])

class UserAccount(Resource):
    def get(self, user_id):
        accounts = Account.query.filter_by(user_id=user_id).all()
        return jsonify([{
            "id": acc.id,
            "balance": acc.balance,
            "equity": acc.equity,
            "initial_balance": acc.initial_balance,
            "daily_starting_equity": acc.daily_starting_equity,
            "status": acc.status,
            "challenge_type": acc.challenge_type
        } for acc in accounts])

class TradeExecution(Resource):
    def post(self):
        data = request.get_json()
        account_id = data.get('account_id')
        asset = data.get('asset')
        side = data.get('side')
        quantity = data.get('quantity')
        price = data.get('price')
        
        result = ChallengeEngine.process_trade(db.session, account_id, asset, side, quantity, price, data.get('market'))
        # Periodic check for rules
        ChallengeEngine.evaluate_account(account_id)
        
        return jsonify(result)

        return jsonify({"status": "success", "message": "Challenge activated", "account_id": account.id})

class CMIGenerateForm(Resource):
    def post(self):
        data = request.get_json()
        user_id = data.get('user_id')
        challenge_id = data.get('challenge_id')
        challenge = Challenge.query.get(challenge_id)
        if not challenge: return {"error": "Challenge not found"}, 404
        
        config = CMIConfig.query.order_by(CMIConfig.created_at.desc()).first()
        if not config: return {"error": "CMI not configured"}, 400
        
        # CMI Fields
        fields = {
            "clientid": config.store_id,
            "amount": str(challenge.price_dh),
            "currency": "504", # MAD
            "oid": f"TS-{int(time.time())}-{user_id}",
            "okUrl": "http://localhost:8080/dashboard/challenge?mode=paid",
            "failUrl": "http://localhost:8080/checkout",
            "lang": "fr",
            "email": "trader@tradesense.ai", # Should be real user email
            "hashAlgorithm": "ver3",
            "shopurl": "http://localhost:8080",
            "callbackUrl": "http://localhost:8000/api/cmi/callback",
            "encoding": "UTF-8"
        }
        
        fields["HASH"] = PaymentService.generate_cmi_hash(fields, config.shared_secret)
        return jsonify({
            "action": "https://test.cmi.ma/fim/est3Dgate" if config.mode == 'test' else "https://payment.cmi.ma/fim/est3Dgate",
            "fields": fields
        })

class CMICallback(Resource):
    def post(self):
        # CMI sends data as form-data
        data = request.form.to_dict()
        oid = data.get('oid')
        response = data.get('Response')
        
        if response == 'Approved':
            # Extract user_id and challenge_id from OID (e.g., TS-TIMESTAMP-USERID)
            parts = oid.split('-')
            user_id = int(parts[2])
            # In a real app, we would store the order in a separate table to get the challenge_id
            # For this MVP, we assume the latest pending challenge for this user or pass it in a custom field
            # For simplicity, we'll need to improve the OID to include challenge_id
            # Or use a separate "Orders" table.
            
            # Let's assume the OID is TS-TIMESTAMP-USERID-CHALLENGEID
            if len(parts) >= 4:
                challenge_id = int(parts[3])
                activate_challenge(user_id, challenge_id, payment_method='cmi')
            
        return "ACTION=POSTAUTH", 200

class CryptoCreateOrder(Resource):
    def post(self):
        data = request.get_json()
        user_id = data.get('user_id')
        challenge_id = data.get('challenge_id')
        challenge = Challenge.query.get(challenge_id)
        if not challenge: return {"error": "Challenge not found"}, 404
        
        # Convert MAD to USD for Binance Pay if needed, or use USDT
        # For this demo, we use the price_dh as amount in USDT/USD
        res = PaymentService.create_binance_order(challenge.price_dh, "USDT", challenge.name, user_id)
        
        if res.get("status") == "SUCCESS":
            return jsonify({"status": "success", "checkoutUrl": res["data"]["checkoutUrl"]})
        return jsonify({"error": res.get("errorMessage", "Binance Pay failed")}), 400

class PayPalConfigResource(Resource):
    def post(self):
        data = request.get_json()
        client_id = data.get('client_id')
        client_secret = data.get('client_secret')
        mode = data.get('mode', 'sandbox')
        currency_code = data.get('currency_code', 'USD')
        if not client_id or not client_secret:
            return {"error": "Missing PayPal credentials"}, 400

        PayPalConfig.query.delete()
        config = PayPalConfig(
            client_id=client_id,
            client_secret=client_secret,
            mode=mode,
            currency_code=currency_code
        )
        db.session.add(config)
        db.session.add(AdminActionLog(action='paypal_config', details=f"PayPal mode={mode} currency={currency_code}"))
        db.session.commit()
        return {"status": "saved"}

class PayPalPublicConfigResource(Resource):
    def get(self):
        config = PayPalConfig.query.order_by(PayPalConfig.created_at.desc()).first()
        if not config:
            return {"error": "PayPal not configured"}, 404
        return {"client_id": config.client_id, "currency_code": config.currency_code}

class PayPalCreateOrder(Resource):
    def post(self):
        if requests is None:
            return {"error": "requests is not installed"}, 500
        data = request.get_json()
        user_id = data.get('user_id')
        challenge_id = data.get('challenge_id')
        challenge = Challenge.query.get(challenge_id)
        if not challenge:
            return {"error": "Challenge not found"}, 404

        config = PayPalConfig.query.order_by(PayPalConfig.created_at.desc()).first()
        if not config:
            return {"error": "PayPal not configured"}, 400

        base_url = "https://api-m.sandbox.paypal.com" if config.mode == 'sandbox' else "https://api-m.paypal.com"
        auth = base64.b64encode(f"{config.client_id}:{config.client_secret}".encode()).decode()
        token_res = requests.post(
            f"{base_url}/v1/oauth2/token",
            headers={"Authorization": f"Basic {auth}"},
            data={"grant_type": "client_credentials"},
            timeout=10
        )
        if token_res.status_code != 200:
            return {"error": "Failed to get PayPal token"}, 400
        access_token = token_res.json().get("access_token")

        order_res = requests.post(
            f"{base_url}/v2/checkout/orders",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            },
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": str(challenge_id),
                    "amount": {
                        "currency_code": config.currency_code,
                        "value": str(challenge.price_dh)
                    }
                }]
            },
            timeout=10
        )
        if order_res.status_code not in (200, 201):
            return {"error": "Failed to create PayPal order"}, 400
        return order_res.json()

class PayPalCaptureOrder(Resource):
    def post(self):
        if requests is None:
            return {"error": "requests is not installed"}, 500
        data = request.get_json()
        order_id = data.get('order_id')
        user_id = data.get('user_id')
        challenge_id = data.get('challenge_id')
        if not order_id:
            return {"error": "Missing order id"}, 400

        config = PayPalConfig.query.order_by(PayPalConfig.created_at.desc()).first()
        if not config:
            return {"error": "PayPal not configured"}, 400

        base_url = "https://api-m.sandbox.paypal.com" if config.mode == 'sandbox' else "https://api-m.paypal.com"
        auth = base64.b64encode(f"{config.client_id}:{config.client_secret}".encode()).decode()
        token_res = requests.post(
            f"{base_url}/v1/oauth2/token",
            headers={"Authorization": f"Basic {auth}"},
            data={"grant_type": "client_credentials"},
            timeout=10
        )
        if token_res.status_code != 200:
            return {"error": "Failed to get PayPal token"}, 400
        access_token = token_res.json().get("access_token")

        capture_res = requests.post(
            f"{base_url}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            },
            timeout=10
        )
        if capture_res.status_code not in (200, 201):
            return {"error": "Failed to capture PayPal order"}, 400

        account, result = activate_challenge(user_id, challenge_id, payment_method='paypal')
        if not account:
            return result, 400
        return {"status": "success", "account_id": account.id, "paypal": capture_res.json()}

class LeaderboardResource(Resource):
    def get(self):
        accounts = Account.query.all()
        rows = []
        for account in accounts:
            user = User.query.get(account.user_id)
            if account.initial_balance and account.initial_balance > 0:
                profit_pct = ((account.equity - account.initial_balance) / account.initial_balance) * 100
            else:
                profit_pct = 0
            trades_count = Trade.query.filter_by(account_id=account.id).count()
            rows.append({
                "user_name": user.username if user else "Unknown",
                "profit_pct": round(profit_pct, 2),
                "status": account.status,
                "trades": trades_count
            })
        rows.sort(key=lambda x: x["profit_pct"], reverse=True)
        return jsonify(rows[:10])

class AdminAccountsResource(Resource):
    def get(self):
        accounts = Account.query.all()
        result = []
        for a in accounts:
            user = User.query.get(a.user_id)
            result.append({
                'id': a.id,
                'user_id': a.user_id,
                'user_name': user.username if user else "Unknown",
                'balance': a.balance,
                'equity': a.equity,
                'status': a.status,
                'challenge_type': a.challenge_type
            })
        return jsonify(result)

class AdminUpdateAccountStatusResource(Resource):
    def post(self, account_id):
        data = request.json
        account = Account.query.get(account_id)
        if not account:
            return {'error': 'Account not found'}, 404
        
        account.status = data.get('status')
        db.session.add(AdminActionLog(action='account_status', details=f"Account {account_id} -> {account.status}"))
        db.session.commit()
        return {'message': f'Account {account_id} status updated to {account.status}'}

class PortfolioResource(Resource):
    def get(self, user_id):
        account = Account.query.filter_by(user_id=user_id).first()
        if not account:
            return {"error": "Account not found"}, 404
        positions = Position.query.filter_by(account_id=account.id).all()
        trades = Trade.query.filter_by(account_id=account.id).order_by(Trade.timestamp.desc()).limit(50).all()
        return jsonify({
            "account": {
                "id": account.id,
                "balance": account.balance,
                "equity": account.equity,
                "initial_balance": account.initial_balance,
                "daily_starting_equity": account.daily_starting_equity,
                "status": account.status,
                "challenge_type": account.challenge_type
            },
            "positions": [{
                "asset": p.asset,
                "quantity": p.quantity,
                "avg_entry_price": p.avg_entry_price
            } for p in positions],
            "trades": [{
                "asset": t.asset,
                "type": t.type,
                "entry_price": t.entry_price,
                "quantity": t.quantity,
                "profit": t.profit,
                "timestamp": t.timestamp.isoformat()
            } for t in trades]
        })

class MarketPulseResource(Resource):
    def get(self):
        tickers = ['BTC-USD', 'MAD=X', '^IXIC']
        snapshot = MarketDataService.get_fast_snapshot(tickers)
        bvc_prices = MarketDataService.get_bvc_live_market_prices()
        iam_price = bvc_prices.get('IAM')
        return jsonify({
            "btc": {
                "symbol": "BTC-USD",
                "price": snapshot.get('BTC-USD', {}).get('price'),
                "change_pct": snapshot.get('BTC-USD', {}).get('change_pct')
            },
            "iam": {
                "symbol": "IAM",
                "price": iam_price,
                "change_pct": None
            },
            "usd_mad": {
                "symbol": "USD/MAD",
                "price": snapshot.get('MAD=X', {}).get('price'),
                "change_pct": snapshot.get('MAD=X', {}).get('change_pct')
            },
            "nasdaq": {
                "symbol": "NASDAQ",
                "price": snapshot.get('^IXIC', {}).get('price'),
                "change_pct": snapshot.get('^IXIC', {}).get('change_pct')
            }
        })

class NewsResource(Resource):
    def get(self):
        items = NewsService.get_latest()
        return jsonify(items)

class AdminLogsResource(Resource):
    def get(self):
        logs = AdminActionLog.query.order_by(AdminActionLog.created_at.desc()).limit(20).all()
        return jsonify([{
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at.isoformat()
        } for log in logs])

class AISignalsResource(Resource):
    def get(self):
        signals = AIService.generate_signals()
        return jsonify(signals)

class AIPredictionResource(Resource):
    def get(self, symbol):
        prediction = AIService.get_prediction(symbol)
        if not prediction:
            return {"error": "Asset not found or no price available"}, 404
        return jsonify(prediction)

# Register Resources
api.add_resource(MarketDataResource, '/api/market-data')
api.add_resource(MarketOverviewResource, '/api/market-overview')
api.add_resource(MarketHistoryResource, '/api/market-history')
api.add_resource(MarketPulseResource, '/api/market-pulse')
api.add_resource(BVCOverviewResource, '/api/bvc/overview')
api.add_resource(BVCStreamResource, '/api/bvc/stream')
api.add_resource(ChallengeList, '/api/challenges')
api.add_resource(UserAccount, '/api/accounts/<int:user_id>')
api.add_resource(PortfolioResource, '/api/portfolio/<int:user_id>')
api.add_resource(TradeExecution, '/api/trade')
api.add_resource(PayPalConfigResource, '/api/paypal/config')
api.add_resource(PayPalPublicConfigResource, '/api/paypal/config/public')
api.add_resource(PayPalCreateOrder, '/api/paypal/create-order')
api.add_resource(PayPalCaptureOrder, '/api/paypal/capture-order')
api.add_resource(LeaderboardResource, '/api/leaderboard')
api.add_resource(NewsResource, '/api/news')
api.add_resource(AdminAccountsResource, '/api/admin/accounts')
api.add_resource(AdminUpdateAccountStatusResource, '/api/admin/accounts/<int:account_id>/status')
api.add_resource(AISignalsResource, '/api/ai/signals')
api.add_resource(AIPredictionResource, '/api/ai/predict/<string:symbol>')
api.add_resource(CMIGenerateForm, '/api/cmi/generate-form')
api.add_resource(CMICallback, '/api/cmi/callback')
api.add_resource(CryptoCreateOrder, '/api/crypto/create-order')
api.add_resource(MarketDataCasablancaResource, '/api/market-data/casablanca')
