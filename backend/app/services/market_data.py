try:
    import yfinance as yf
except Exception:
    yf = None
import asyncio
import math
import os
from typing import List, Dict, Any, Optional
from .caching import cache
from .casablanca_service import scrape_casablanca_stock_exchange, scrape_casablanca_live_overview

try:
    import requests
except Exception:
    requests = None

import csv
import json
import time
from datetime import datetime, timedelta

# Static asset lists
NASDAQ_TOP_50 = [
    {"symbol": "AAPL", "name": "Apple"}, {"symbol": "MSFT", "name": "Microsoft"},
    {"symbol": "NVDA", "name": "NVIDIA"}, {"symbol": "AMZN", "name": "Amazon"},
    {"symbol": "META", "name": "Meta Platforms"}, {"symbol": "GOOGL", "name": "Alphabet Class A"},
    {"symbol": "TSLA", "name": "Tesla"}, {"symbol": "AVGO", "name": "Broadcom"},
    {"symbol": "COST", "name": "Costco"}, {"symbol": "NFLX", "name": "Netflix"}
    # Add more if needed, keeping the list manageable
]
CRYPTO_TICKERS = [
    {"symbol": "BTC-USD", "name": "Bitcoin"}, {"symbol": "ETH-USD", "name": "Ethereum"},
    {"symbol": "BNB-USD", "name": "BNB"}, {"symbol": "SOL-USD", "name": "Solana"}
]
FOREX_TICKERS = [
    {"symbol": "EURUSD=X", "name": "EUR/USD"}, {"symbol": "GBPUSD=X", "name": "GBP/USD"},
    {"symbol": "USDJPY=X", "name": "USD/JPY"}
]

REQUEST_TIMEOUT = float(os.environ.get("MARKET_HTTP_TIMEOUT", "6"))
REQUEST_SESSION = requests.Session() if requests is not None else None
YAHOO_CACHE_TTL = int(os.environ.get("YAHOO_CACHE_TTL", "120"))
FINNHUB_CACHE_TTL = int(os.environ.get("FINNHUB_CACHE_TTL", "30"))


class MarketDataService:
    _yahoo_snapshot_cache: Dict[str, Dict[str, Any]] = {}
    _yahoo_snapshot_ts: float = 0.0
    _finnhub_snapshot_cache: Dict[str, Dict[str, Any]] = {}
    _finnhub_snapshot_ts: float = 0.0
    @staticmethod
    def _http_headers() -> Dict[str, str]:
        return {
            "User-Agent": "TradeSenseAI/1.0 (+https://tradesense.ai)",
            "Accept": "application/json,text/csv,text/plain",
        }

    @staticmethod
    def _massive_key() -> str:
        return os.environ.get("MASSIVE_API_KEY", "").strip()

    @staticmethod
    def _finnhub_key() -> str:
        return os.environ.get("FINNHUB_API_KEY", "").strip()

    @staticmethod
    def _binance_symbol(symbol: str) -> str:
        if symbol.endswith("-USD"):
            return symbol.replace("-USD", "") + "USDT"
        return symbol

    @staticmethod
    def _forex_pair(symbol: str) -> Optional[Dict[str, str]]:
        if not symbol.endswith("=X") or len(symbol) < 7:
            return None
        pair = symbol.replace("=X", "")
        return {"base": pair[:3], "quote": pair[3:6]}

    @staticmethod
    def _stooq_symbol(symbol: str) -> str:
        return f"{symbol.lower()}.us"

    @staticmethod
    def _fetch_binance_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        if requests is None or not symbols:
            return {}
        mapped = [MarketDataService._binance_symbol(sym) for sym in symbols]
        reverse_map = {mapped_symbol: original for mapped_symbol, original in zip(mapped, symbols)}
        base_urls = ["https://api.binance.com", "https://api1.binance.com", "https://api.binance.us"]
        snapshot: Dict[str, Dict[str, Any]] = {}
        for base_url in base_urls:
            try:
                res = (REQUEST_SESSION or requests).get(
                    f"{base_url}/api/v3/ticker/24hr",
                    params={"symbols": json.dumps(mapped)},
                    headers=MarketDataService._http_headers(),
                    timeout=REQUEST_TIMEOUT,
                )
            except Exception:
                continue
            if res.status_code != 200:
                continue
            data = res.json()
            if isinstance(data, dict) and data.get("code") is not None:
                continue
            if not isinstance(data, list):
                continue
            for item in data:
                symbol = item.get("symbol")
                original = reverse_map.get(symbol)
                if not original:
                    continue
                snapshot[original] = {
                    "price": MarketDataService._to_json_number(item.get("lastPrice")),
                    "change_pct": MarketDataService._to_json_number(item.get("priceChangePercent")),
                    "volume": MarketDataService._to_json_number(item.get("volume"), as_int=True),
                }
            if snapshot:
                return snapshot

        # Per-symbol fallback if bulk is blocked.
        for base_url in base_urls:
            for symbol in mapped:
                if reverse_map[symbol] in snapshot:
                    continue
                try:
                    res = (REQUEST_SESSION or requests).get(
                        f"{base_url}/api/v3/ticker/24hr",
                        params={"symbol": symbol},
                        headers=MarketDataService._http_headers(),
                        timeout=REQUEST_TIMEOUT,
                    )
                except Exception:
                    continue
                if res.status_code != 200:
                    continue
                item = res.json()
                if isinstance(item, dict) and item.get("code") is not None:
                    continue
                original = reverse_map.get(item.get("symbol"))
                if not original:
                    continue
                snapshot[original] = {
                    "price": MarketDataService._to_json_number(item.get("lastPrice")),
                    "change_pct": MarketDataService._to_json_number(item.get("priceChangePercent")),
                    "volume": MarketDataService._to_json_number(item.get("volume"), as_int=True),
                }
            if snapshot:
                return snapshot
        return snapshot

    @staticmethod
    def _fetch_binance_history(symbol: str, points: int) -> List[float]:
        if requests is None:
            return []
        mapped = MarketDataService._binance_symbol(symbol)
        try:
            res = (REQUEST_SESSION or requests).get(
                "https://api.binance.com/api/v3/klines",
                params={"symbol": mapped, "interval": "1d", "limit": points},
                headers=MarketDataService._http_headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except Exception:
            return []
        if res.status_code != 200:
            return []
        data = res.json()
        series = []
        for row in data:
            price = MarketDataService._to_json_number(row[4])
            if price is None:
                continue
            series.append(round(price, 4))
        return series

    @staticmethod
    def _fetch_forex_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        if requests is None or not symbols:
            return {}
        by_base: Dict[str, List[str]] = {}
        pairs = {}
        for symbol in symbols:
            pair = MarketDataService._forex_pair(symbol)
            if not pair:
                continue
            base = pair["base"]
            quote = pair["quote"]
            by_base.setdefault(base, []).append(quote)
            pairs[symbol] = pair
        snapshot: Dict[str, Dict[str, Any]] = {}
        for base, quotes in by_base.items():
            try:
                res = (REQUEST_SESSION or requests).get(
                    "https://api.frankfurter.app/latest",
                    params={"from": base, "to": ",".join(quotes)},
                    headers=MarketDataService._http_headers(),
                    timeout=REQUEST_TIMEOUT,
                )
            except Exception:
                continue
            if res.status_code != 200:
                continue
            data = res.json()
            rates = data.get("rates") or {}
            for symbol, pair in pairs.items():
                if pair["base"] != base:
                    continue
                price = MarketDataService._to_json_number(rates.get(pair["quote"]))
                if price is None:
                    continue
                snapshot[symbol] = {"price": price, "change_pct": None, "volume": None}
        return snapshot

    @staticmethod
    def _fetch_forex_history(symbol: str, points: int) -> List[float]:
        if requests is None:
            return []
        pair = MarketDataService._forex_pair(symbol)
        if not pair:
            return []
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=max(points * 2, 30))
        try:
            res = (REQUEST_SESSION or requests).get(
                f"https://api.frankfurter.app/{start_date.isoformat()}..{end_date.isoformat()}",
                params={"from": pair["base"], "to": pair["quote"]},
                headers=MarketDataService._http_headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except Exception:
            return []
        if res.status_code != 200:
            return []
        data = res.json()
        rates = data.get("rates") or {}
        series = []
        for date_key in sorted(rates.keys()):
            price = MarketDataService._to_json_number(rates[date_key].get(pair["quote"]))
            if price is None:
                continue
            series.append(round(price, 6))
        return series[-points:]

    @staticmethod
    def _fetch_stooq_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        if requests is None or not symbols:
            return {}
        snapshot: Dict[str, Dict[str, Any]] = {}
        for original in symbols:
            mapped = MarketDataService._stooq_symbol(original)
            try:
                res = (REQUEST_SESSION or requests).get(
                    "https://stooq.com/q/l/",
                    params={"s": mapped, "f": "sd2t2ohlcv", "h": "1", "e": "csv"},
                    headers=MarketDataService._http_headers(),
                    timeout=REQUEST_TIMEOUT,
                )
            except Exception:
                continue
            if res.status_code != 200:
                continue
            reader = csv.DictReader(res.text.splitlines())
            row = next(reader, None)
            if not row:
                continue
            close = MarketDataService._to_json_number(row.get("Close"))
            volume = MarketDataService._to_json_number(row.get("Volume"), as_int=True)
            if close is None:
                continue
            snapshot[original] = {"price": close, "change_pct": None, "volume": volume}
        return snapshot

    @staticmethod
    def _fetch_stooq_history(symbol: str, points: int) -> List[float]:
        if requests is None:
            return []
        mapped = MarketDataService._stooq_symbol(symbol)
        try:
            res = (REQUEST_SESSION or requests).get(
                "https://stooq.com/q/d/l/",
                params={"s": mapped, "i": "d"},
                headers=MarketDataService._http_headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except Exception:
            return []
        if res.status_code != 200:
            return []
        reader = csv.DictReader(res.text.splitlines())
        series = []
        for row in reader:
            close = MarketDataService._to_json_number(row.get("Close"))
            if close is None:
                continue
            series.append(round(close, 4))
        return series[-points:]

    @staticmethod
    def _fetch_free_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        crypto = [s for s in symbols if s.endswith("-USD")]
        forex = [s for s in symbols if s.endswith("=X")]
        stocks = [s for s in symbols if s not in crypto and s not in forex]
        snapshot: Dict[str, Dict[str, Any]] = {}
        snapshot.update(MarketDataService._fetch_binance_snapshot(crypto))
        snapshot.update(MarketDataService._fetch_forex_snapshot(forex))
        snapshot.update(MarketDataService._fetch_yahoo_quote_snapshot(stocks))
        return snapshot

    @staticmethod
    def _fetch_yahoo_quote_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        if requests is None or not symbols:
            return {}
        try:
            res = (REQUEST_SESSION or requests).get(
                "https://query1.finance.yahoo.com/v7/finance/quote",
                params={"symbols": ",".join(symbols)},
                headers=MarketDataService._http_headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except Exception:
            return {}
        if res.status_code == 429:
            now = time.time()
            if now - MarketDataService._yahoo_snapshot_ts < YAHOO_CACHE_TTL:
                return {k: v for k, v in MarketDataService._yahoo_snapshot_cache.items() if k in symbols}
            return {}
        if res.status_code != 200:
            return {}
        data = res.json()
        results = data.get("quoteResponse", {}).get("result", [])
        snapshot: Dict[str, Dict[str, Any]] = {}
        for item in results:
            symbol = item.get("symbol")
            if not symbol:
                continue
            snapshot[symbol] = {
                "price": MarketDataService._to_json_number(item.get("regularMarketPrice")),
                "change_pct": MarketDataService._to_json_number(item.get("regularMarketChangePercent")),
                "volume": MarketDataService._to_json_number(item.get("regularMarketVolume"), as_int=True),
            }
        if snapshot:
            MarketDataService._yahoo_snapshot_cache.update(snapshot)
            MarketDataService._yahoo_snapshot_ts = time.time()
        return snapshot

    @staticmethod
    def _fetch_massive_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        api_key = MarketDataService._massive_key()
        if not api_key or requests is None or not symbols:
            return {}
        try:
            res = (REQUEST_SESSION or requests).get(
                "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers",
                params={"tickers": ",".join(symbols), "apiKey": api_key},
                headers=MarketDataService._http_headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except Exception:
            return {}
        if res.status_code != 200:
            return {}
        data = res.json()
        tickers = data.get("tickers") or []
        snapshot: Dict[str, Dict[str, Any]] = {}
        for item in tickers:
            symbol = item.get("ticker")
            if not symbol:
                continue
            last_trade = item.get("lastTrade") or {}
            day = item.get("day") or {}
            prev = item.get("prevDay") or {}
            price = MarketDataService._to_json_number(last_trade.get("p")) or MarketDataService._to_json_number(day.get("c"))
            prev_close = MarketDataService._to_json_number(prev.get("c"))
            change_pct = None
            if price is not None and prev_close:
                change_pct = round(((price - prev_close) / prev_close) * 100, 2)
            snapshot[symbol] = {
                "price": price,
                "change_pct": change_pct,
                "volume": MarketDataService._to_json_number(day.get("v"), as_int=True),
            }
        return snapshot

    @staticmethod
    def _fetch_finnhub_snapshot(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        api_key = MarketDataService._finnhub_key()
        if not api_key or requests is None or not symbols:
            return {}
        now = time.time()
        if now - MarketDataService._finnhub_snapshot_ts < FINNHUB_CACHE_TTL:
            cached = {k: v for k, v in MarketDataService._finnhub_snapshot_cache.items() if k in symbols}
        else:
            cached = {}
        snapshot: Dict[str, Dict[str, Any]] = {}
        for symbol in symbols:
            if symbol in cached:
                snapshot[symbol] = cached[symbol]
                continue
            try:
                res = (REQUEST_SESSION or requests).get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": symbol, "token": api_key},
                    headers=MarketDataService._http_headers(),
                    timeout=REQUEST_TIMEOUT,
                )
            except Exception:
                continue
            if res.status_code != 200:
                continue
            data = res.json()
            price = MarketDataService._to_json_number(data.get("c"))
            prev_close = MarketDataService._to_json_number(data.get("pc"))
            change_pct = None
            if price is not None and prev_close:
                change_pct = round(((price - prev_close) / prev_close) * 100, 2)
            if price is None:
                continue
            snapshot[symbol] = {
                "price": price,
                "change_pct": change_pct,
                "volume": None,
            }
        if snapshot:
            MarketDataService._finnhub_snapshot_cache.update(snapshot)
            MarketDataService._finnhub_snapshot_ts = now
        return snapshot

    @staticmethod
    def _fetch_stock_snapshot_from_history(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        snapshot: Dict[str, Dict[str, Any]] = {}
        for symbol in symbols:
            series = MarketDataService._fetch_stooq_history(symbol, 2)
            if not series:
                continue
            price = series[-1]
            change_pct = None
            if len(series) > 1 and series[-2]:
                change_pct = round(((series[-1] - series[-2]) / series[-2]) * 100, 2)
            snapshot[symbol] = {
                "price": price,
                "change_pct": change_pct,
                "volume": None,
            }
        return snapshot

    @staticmethod
    def _to_json_number(value, *, as_int: bool = False):
        if value is None:
            return None
        try:
            num = float(value)
        except Exception:
            return None
        if not math.isfinite(num):
            return None
        if as_int:
            return int(num)
        return num

    @staticmethod
    def _run_async(coro):
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Run in a fresh loop to avoid "already running" errors.
            new_loop = asyncio.new_event_loop()
            try:
                return new_loop.run_until_complete(coro)
            finally:
                new_loop.close()
        return asyncio.run(coro)

    @staticmethod
    def get_all_prices(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        if not tickers:
            return {}
        return MarketDataService._run_async(MarketDataService.get_yahoo_snapshot_async(tickers))

    @staticmethod
    def get_fast_snapshot(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        return MarketDataService.get_all_prices(tickers)

    @staticmethod
    def get_bvc_live_market_prices() -> Dict[str, Any]:
        result = scrape_casablanca_live_overview()
        if result.get("status") != "success":
            return {}
        prices = {}
        for stock in result.get("data", []):
            ticker = stock.get("ticker")
            if ticker:
                price = stock.get("closing_price")
                try:
                    prices[ticker] = float(price)
                except Exception:
                    prices[ticker] = price
        return prices

    @staticmethod
    def get_market_universe_cached() -> List[Dict[str, Any]]:
        service = MarketDataService()
        return MarketDataService._run_async(service.get_market_universe_async())

    @staticmethod
    def get_history_cached(symbols: List[str], points: int) -> Dict[str, List[float]]:
        service = MarketDataService()
        return MarketDataService._run_async(service.get_history_cached_async(symbols, points))

    @staticmethod
    async def get_yahoo_snapshot_async(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Asynchronously fetches snapshot data for a list of tickers from Yahoo Finance.
        Runs the synchronous yf.download in a separate thread.
        """
        if not tickers:
            return {}
        
        crypto = [s for s in tickers if s.endswith("-USD")]
        forex = [s for s in tickers if s.endswith("=X")]
        stocks = [s for s in tickers if s not in crypto and s not in forex]

        crypto_task = asyncio.to_thread(MarketDataService._fetch_binance_snapshot, crypto)
        forex_task = asyncio.to_thread(MarketDataService._fetch_forex_snapshot, forex)
        finnhub_task = asyncio.to_thread(MarketDataService._fetch_finnhub_snapshot, stocks)
        yahoo_task = asyncio.to_thread(MarketDataService._fetch_yahoo_quote_snapshot, stocks or tickers)

        crypto_snapshot, forex_snapshot, finnhub_snapshot, yahoo_snapshot = await asyncio.gather(
            crypto_task, forex_task, finnhub_task, yahoo_task
        )
        merged = {**(crypto_snapshot or {}), **(forex_snapshot or {}), **(finnhub_snapshot or {})}
        missing = [s for s in tickers if s not in merged]
        if missing:
            history_snapshot = await asyncio.to_thread(MarketDataService._fetch_stock_snapshot_from_history, missing)
            merged = {**merged, **(history_snapshot or {})}
        if yahoo_snapshot:
            for symbol, data in yahoo_snapshot.items():
                if symbol not in merged or merged[symbol].get("price") is None:
                    merged[symbol] = data
        missing = [s for s in tickers if s not in merged]
        if not missing:
            return merged

        # If yfinance is not available (offline dev), return what we have
        if yf is None:
            return merged

        def blocking_download():
            return yf.download(
                tickers=" ".join(missing),
                period="2d",  # 2 days to ensure we have a previous close for change calculation
                interval="1d",
                group_by="ticker",
                progress=False,
                threads=True,
            )

        try:
            data = await asyncio.to_thread(blocking_download)
        except Exception:
            return merged
        
        snapshots = {}
        if data.empty:
            return merged

        for ticker in missing:
            ticker_data = data.get(ticker)
            if ticker_data is None or ticker_data.empty:
                # Handle single ticker download case
                if len(missing) == 1 and not data.empty:
                    ticker_data = data
                else:
                    continue

            close_series = ticker_data["Close"].dropna()
            if len(close_series) >= 2:
                last_price = close_series.iloc[-1]
                prev_price = close_series.iloc[-2]
                change_pct = ((last_price - prev_price) / prev_price) * 100
                volume_value = ticker_data["Volume"].iloc[-1] if "Volume" in ticker_data and not ticker_data["Volume"].empty else None
                snapshots[ticker] = {
                    "price": MarketDataService._to_json_number(round(last_price, 4)),
                    "change_pct": MarketDataService._to_json_number(round(change_pct, 2)),
                    "volume": MarketDataService._to_json_number(volume_value, as_int=True),
                }
            elif len(close_series) == 1:
                 volume_value = ticker_data["Volume"].iloc[-1] if "Volume" in ticker_data and not ticker_data["Volume"].empty else None
                 snapshots[ticker] = {
                    "price": MarketDataService._to_json_number(round(close_series.iloc[-1], 4)),
                    "change_pct": 0.0,
                    "volume": MarketDataService._to_json_number(volume_value, as_int=True),
                }
        return {**merged, **snapshots}

    @staticmethod
    async def get_history_async(tickers: List[str], points: int = 20) -> Dict[str, List[float]]:
        """
        Asynchronously fetches historical data for a list of tickers from Yahoo Finance.
        """
        if not tickers:
            return {}

        history: Dict[str, List[float]] = {}
        for symbol in tickers:
            if symbol.endswith("-USD"):
                history[symbol] = await asyncio.to_thread(MarketDataService._fetch_binance_history, symbol, points)
            elif symbol.endswith("=X"):
                history[symbol] = await asyncio.to_thread(MarketDataService._fetch_forex_history, symbol, points)
            else:
                history[symbol] = await asyncio.to_thread(MarketDataService._fetch_stooq_history, symbol, points)

        missing = [s for s in tickers if not history.get(s)]

        # If yfinance is not available (offline dev), return what we have
        if yf is None:
            return history

        def blocking_download():
            return yf.download(
                tickers=" ".join(missing),
                period="1mo", # Get a month of data to have enough points
                interval="1d",
                group_by="ticker",
                progress=False,
                threads=True,
            )
        
        try:
            data = await asyncio.to_thread(blocking_download)
        except Exception:
            return history
        
        if data.empty:
            return history

        for ticker in missing:
            ticker_data = data.get(ticker)
            if ticker_data is None or ticker_data.empty:
                 if len(missing) == 1 and not data.empty:
                    ticker_data = data
                 else:
                    history[ticker] = history.get(ticker, [])
                    continue

            series = ticker_data["Close"].dropna()
            history[ticker] = [round(val, 4) for val in series.tail(points).tolist()]
            
        return history

    @cache(ttl_seconds=int(os.environ.get("MARKET_OVERVIEW_TTL", "8")))
    async def get_market_universe_async(self) -> List[Dict[str, Any]]:
        """
        Asynchronously builds a full market overview, fetching data from BVC and Yahoo Finance
        concurrently. Cache TTL is controlled by MARKET_OVERVIEW_TTL (default 8s).
        """
        # Define tasks to be run concurrently
        bvc_task = asyncio.to_thread(scrape_casablanca_live_overview)
        
        yahoo_symbols = [item["symbol"] for item in NASDAQ_TOP_50 + CRYPTO_TICKERS + FOREX_TICKERS]
        yahoo_task = self.get_yahoo_snapshot_async(yahoo_symbols)

        # Run tasks concurrently and wait for results
        bvc_result, yahoo_snapshot = await asyncio.gather(bvc_task, yahoo_task)

        assets = []
        
        # Process BVC data
        if bvc_result.get("status") == "success":
            for stock in bvc_result.get("data", []):
                closing_price = stock.get("closing_price")
                variation = stock.get("variation")
                assets.append({
                    "symbol": stock.get("ticker"),
                    "name": stock.get("label"),
                    "market": "Bourse de Casablanca",
                    "currency": "DH",
                    "price": MarketDataService._to_json_number(closing_price),
                    "change_pct": MarketDataService._to_json_number(variation),
                    "volume": None, # API doesn't provide volume
                })

        # Process Yahoo Finance data
        all_yahoo_assets = NASDAQ_TOP_50 + CRYPTO_TICKERS + FOREX_TICKERS
        for item in all_yahoo_assets:
            snapshot = yahoo_snapshot.get(item["symbol"], {})
            market_map = {"-USD": "Crypto", "=X": "Forex"}
            market = next((m for k, m in market_map.items() if item["symbol"].endswith(k)), "Nasdaq")
            currency = "DH" if market == "Bourse de Casablanca" else "$"
            
            assets.append({
                "symbol": item["symbol"],
                "name": item["name"],
                "market": market,
                "currency": currency,
                "price": MarketDataService._to_json_number(snapshot.get("price")),
                "change_pct": MarketDataService._to_json_number(snapshot.get("change_pct")),
                "volume": MarketDataService._to_json_number(snapshot.get("volume"), as_int=True),
            })
            
        return assets

    @cache(ttl_seconds=60)
    async def get_history_cached_async(self, symbols: List[str], points: int) -> Dict[str, List[float]]:
        """
        Asynchronously gets and caches historical data. Caches the result in Redis for 60 seconds.
        """
        return await self.get_history_async(symbols, points)
