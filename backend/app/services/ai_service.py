from .market_data import MarketDataService

class AIService:
    @staticmethod
    def generate_signals():
        assets = MarketDataService.get_market_universe_cached()
        signals = []
        for asset in assets[:12]:
            change = asset.get("change_pct")
            if change is None:
                side = "HOLD"
                confidence = 55
                reason = "Insufficient data"
            elif change > 0:
                side = "BUY"
                confidence = min(95, 60 + int(change * 2))
                reason = "Positive momentum"
            else:
                side = "SELL"
                confidence = min(95, 60 + int(abs(change) * 2))
                reason = "Negative momentum"
            signals.append({
                "symbol": asset.get("symbol"),
                "side": side,
                "confidence": confidence,
                "reason": reason
            })
        return signals

    @staticmethod
    def get_prediction(symbol):
        assets = MarketDataService.get_market_universe_cached()
        asset = next((a for a in assets if a.get("symbol") == symbol), None)
        if not asset:
            return None
        change = asset.get("change_pct")
        if change is None:
            outlook = "neutral"
        elif change > 0:
            outlook = "bullish"
        else:
            outlook = "bearish"
        return {
            "symbol": symbol,
            "price": asset.get("price"),
            "outlook": outlook,
            "confidence": 70 if change is not None else 55
        }
