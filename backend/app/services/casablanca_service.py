import logging
import os
import time

try:
    import requests
except Exception:
    requests = None

try:
    import certifi
except Exception:
    certifi = None

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None


logger = logging.getLogger(__name__)

CACHE_TTL = int(os.environ.get("BVC_CACHE_TTL", "5"))
_cache = {"ts": 0.0, "data": None}
_ssl_verify_env = os.environ.get("BVC_SSL_VERIFY", "1").lower()
if _ssl_verify_env in {"0", "false", "no"}:
    _SSL_VERIFY = False
else:
    _SSL_VERIFY = certifi.where() if certifi is not None else True
_ALLOW_INSECURE = os.environ.get("BVC_ALLOW_INSECURE", "0").lower() not in {"0", "false", "no"}
_FORCE_INSECURE = os.environ.get("BVC_FORCE_INSECURE", "0").lower() not in {"0", "false", "no"}
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("\xa0", "").replace(" ", "").replace(",", ".")
    cleaned = []
    for ch in text:
        if ch.isdigit() or ch in ".-":
            cleaned.append(ch)
    if not cleaned:
        return None
    try:
        return float("".join(cleaned))
    except Exception:
        return None


def _pick_value(source, *keys):
    for key in keys:
        value = source.get(key)
        if value is None:
            continue
        if isinstance(value, str) and value.strip() in {"", "-", "—"}:
            continue
        return value
    return None


def _cache_get(allow_stale: bool = False):
    if _cache["data"] and (time.time() - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]
    if allow_stale and _cache["data"]:
        return {"status": "stale", "data": _cache["data"].get("data", [])}
    return None


def _cache_set(data):
    _cache["ts"] = time.time()
    _cache["data"] = data


def _unavailable_payload(message: str):
    return {"status": "unavailable", "message": message, "data": []}


def _stale_payload(cached):
    return {"status": "stale", "data": cached.get("data", [])}


def _request_with_retries(url, *, params=None, timeout=10, expect_json=False):
    if requests is None:
        raise RuntimeError("requests is not installed")
    attempts = 3
    verify = False if _FORCE_INSECURE else _SSL_VERIFY
    last_error = None
    for _ in range(attempts):
        try:
            response = requests.get(
                url,
                params=params,
                timeout=timeout,
                verify=verify,
                headers=_HEADERS,
            )
            response.raise_for_status()
            return response.json() if expect_json else response.text
        except requests.exceptions.SSLError as err:
            last_error = err
            logger.warning("SSL error while fetching Casablanca data: %s", err)
            if verify and _ALLOW_INSECURE:
                verify = False
                continue
            break
        except requests.exceptions.RequestException as err:
            last_error = err
            time.sleep(0.4)
    raise last_error


def scrape_casablanca_stock_exchange():
    """
    Scrapes the Casablanca Stock Exchange for real-time data from the API.
    """
    url = "https://www.casablanca-bourse.com/api/proxy/fr/api/bourse/dashboard/ticker"
    params = {
        "marche": "59",
        "class[0]": "25",
    }
    if requests is None:
        return _unavailable_payload("requests is not installed")
    try:
        data = _request_with_retries(url, params=params, timeout=10, expect_json=True)
        values = data.get("data", {}).get("values", [])
        if not isinstance(values, list):
            raise ValueError("Unexpected JSON payload for Casablanca API")
        stocks = []
        for stock_data in values:
            ticker = stock_data.get("ticker")
            if isinstance(ticker, str):
                ticker = ticker.strip().upper()
            closing_price = _to_float(_pick_value(
                stock_data,
                "field_last_price",
                "field_last_price_value",
                "field_closing_price",
                "field_close_price",
                "field_last",
                "field_last_trade_price",
                "field_dernier_cours",
                "field_last_course",
                "field_price",
            ))
            if closing_price is None:
                closing_price = _to_float(_pick_value(
                    stock_data,
                    "field_opening_price",
                    "field_open",
                    "field_high_price",
                    "field_high",
                    "field_low_price",
                    "field_low",
                ))
            stocks.append({
                "ticker": ticker,
                "label": stock_data.get("label") or stock_data.get("libelle"),
                "sector": stock_data.get("sector") or stock_data.get("secteur"),
                "closing_price": closing_price,
                "opening_price": _to_float(_pick_value(stock_data, "field_opening_price", "field_open")),
                "high_price": _to_float(_pick_value(stock_data, "field_high_price", "field_high")),
                "low_price": _to_float(_pick_value(stock_data, "field_low_price", "field_low")),
                "variation": _to_float(_pick_value(
                    stock_data,
                    "field_variation",
                    "field_variation_percent",
                    "field_difference",
                    "field_change",
                )),
            })
        if not stocks:
            cached = _cache_get(allow_stale=True)
            return cached or _unavailable_payload("No Casablanca stocks parsed")
        result = {"status": "success", "data": stocks}
        _cache_set(result)
        return result
    except Exception as exc:
        logger.warning("Casablanca API unavailable: %s", exc)
        cached = _cache_get(allow_stale=True)
        return cached or _unavailable_payload(str(exc))


def scrape_casablanca_live_overview():
    """
    Scrapes the Casablanca Stock Exchange live market overview page for all companies.
    Falls back to the JSON API if HTML parsing fails.
    """
    cached = _cache_get()
    if cached:
        return cached

    if requests is None:
        return _unavailable_payload("requests is not installed")

    api_result = scrape_casablanca_stock_exchange()
    if api_result.get("status") == "success" and api_result.get("data"):
        return api_result

    url = "https://www.casablanca-bourse.com/fr/live-market/overview"
    try:
        html = _request_with_retries(url, timeout=10)
    except Exception as exc:
        logger.warning("Casablanca overview unavailable: %s", exc)
        cached = _cache_get(allow_stale=True)
        return cached or api_result

    if BeautifulSoup is None:
        cached = _cache_get(allow_stale=True)
        return cached or api_result

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        cached = _cache_get(allow_stale=True)
        return cached or api_result

    header_cells = [th.get_text(strip=True).lower() for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        values = [td.get_text(strip=True) for td in tds]
        if header_cells and len(values) == len(header_cells):
            row = dict(zip(header_cells, values))
        else:
            row = {str(i): v for i, v in enumerate(values)}
        rows.append(row)

    if not rows:
        cached = _cache_get(allow_stale=True)
        return cached or _unavailable_payload("No Casablanca stocks parsed")

    stocks = []
    for row in rows:
        ticker = row.get("ticker") or row.get("code") or row.get("0")
        label = row.get("libellé") or row.get("libelle") or row.get("name") or row.get("1")
        sector = row.get("secteur") or row.get("sector") or row.get("2")
        closing_price = _to_float(row.get("dernier") or row.get("cours") or row.get("2"))
        opening_price = _to_float(row.get("ouverture") or row.get("3"))
        high_price = _to_float(row.get("haut") or row.get("4"))
        low_price = _to_float(row.get("bas") or row.get("5"))
        variation = _to_float(row.get("variation") or row.get("6"))
        if closing_price is None:
            closing_price = opening_price or high_price or low_price
        if not ticker:
            continue
        stocks.append({
            "ticker": ticker,
            "label": label,
            "sector": sector,
            "closing_price": closing_price,
            "opening_price": opening_price,
            "high_price": high_price,
            "low_price": low_price,
            "variation": variation,
        })

    if not stocks:
        cached = _cache_get(allow_stale=True)
        return cached or _unavailable_payload("No Casablanca stocks parsed")
    result = {"status": "success", "data": stocks}
    _cache_set(result)
    return result


def get_casablanca_live_data():
    """
    Safe wrapper that always returns a usable payload for streaming.
    """
    result = scrape_casablanca_live_overview()
    if result.get("status") == "success":
        return result
    cached = _cache_get(allow_stale=True)
    if cached:
        return _stale_payload(cached)
    message = result.get("message") if isinstance(result, dict) else "Unknown error"
    return _unavailable_payload(message or "Unknown error")
