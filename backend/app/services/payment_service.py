import hashlib
import hmac
import base64
import json
import time
from models import CMIConfig, CryptoConfig

try:
    import requests
except Exception:
    requests = None

class PaymentService:
    @staticmethod
    def generate_cmi_hash(fields, shared_secret):
        """
        Generate CMI SHA-512 Hash based on the sorted list of fields.
        """
        # CMI requires fields to be sorted by name and concatenated with |
        sorted_keys = sorted(fields.keys())
        hash_str = "|".join([str(fields[k]) for k in sorted_keys]) + "|" + shared_secret
        
        # Hash with SHA-512
        return hashlib.sha512(hash_str.encode('utf-8')).hexdigest().upper()

    @staticmethod
    def create_binance_order(amount, currency, item_name, user_id):
        """
        Integrate with Binance Pay API to create an order.
        """
        if requests is None:
            return {"error": "requests is not installed"}
        config = CryptoConfig.query.order_by(CryptoConfig.created_at.desc()).first()
        if not config:
            return {"error": "Binance Pay not configured"}

        endpoint = "/binancepay/openapi/v2/order"
        base_url = "https://bpay.binanceapi.com"
        
        nonce = str(int(time.time() * 1000))
        timestamp = str(int(time.time() * 1000))
        
        body = {
            "env": {"terminalType": "WEB"},
            "merchantTradeNo": f"TS-{int(time.time())}-{user_id}",
            "orderAmount": amount,
            "currency": currency,
            "goods": {
                "goodsType": "02", # Virtual Goods
                "goodsCategory": "6000",
                "referenceGoodsId": item_name,
                "goodsName": item_name
            },
            "cancelUrl": "http://localhost:8080/checkout",
            "returnUrl": "http://localhost:8080/dashboard/challenge?mode=paid"
        }
        
        json_body = json.dumps(body)
        payload = f"{timestamp}\n{nonce}\n{json_body}\n"
        
        signature = hmac.new(
            config.api_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha512
        ).hexdigest().upper()
        
        headers = {
            "Content-Type": "application/json",
            "BinancePay-Timestamp": timestamp,
            "BinancePay-Nonce": nonce,
            "BinancePay-Certificate-SN": config.api_key, # Usually the API Key
            "BinancePay-Signature": signature
        }
        
        try:
            res = requests.post(f"{base_url}{endpoint}", headers=headers, data=json_body, timeout=10)
            return res.json()
        except Exception as e:
            return {"error": str(e)}
