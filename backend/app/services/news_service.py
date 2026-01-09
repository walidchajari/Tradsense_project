import os
try:
    import requests
except Exception:
    requests = None

class NewsService:
    FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')

    @staticmethod
    def get_latest():
        if not NewsService.FINNHUB_API_KEY or requests is None:
            return NewsService._fallback()
        try:
            res = requests.get(
                "https://finnhub.io/api/v1/news",
                params={"category": "general", "token": NewsService.FINNHUB_API_KEY},
                timeout=10,
            )
            if res.status_code != 200:
                return NewsService._fallback()
            data = res.json()
            items = []
            for item in data[:8]:
                items.append({
                    "headline": item.get("headline"),
                    "summary": item.get("summary") or "Market update",
                    "source": item.get("source")
                })
            return items
        except Exception:
            return NewsService._fallback()

    @staticmethod
    def _fallback():
        return [
            {
                "headline": "Global markets steady ahead of macro releases",
                "summary": "Investors await inflation data while risk assets consolidate.",
                "source": "TradeSense"
            },
            {
                "headline": "Casablanca bourse rotation persists",
                "summary": "Banks lead flows as telecom stabilizes.",
                "source": "TradeSense"
            },
        ]
