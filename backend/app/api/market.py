from fastapi import APIRouter, Query
from ..services.market_data import MarketDataService

router = APIRouter(
    prefix="/api",
    tags=["Market Data"]
)

# Instantiate the service
market_data_service = MarketDataService()

@router.get("/market-overview")
async def get_market_overview(minimal: bool = Query(False)):
    """
    Provides a full overview of all markets, including Nasdaq, Crypto, Forex,
    and Bourse de Casablanca. Results are cached for 15 seconds.
    """
    assets = await market_data_service.get_market_universe_async()
    if not minimal:
        return assets
    return [
        {
            "symbol": asset.get("symbol"),
            "name": asset.get("name"),
            "market": asset.get("market"),
            "currency": asset.get("currency"),
            "price": asset.get("price"),
            "change_pct": asset.get("change_pct"),
        }
        for asset in assets
    ]

@router.get("/market-history")
async def get_market_history(symbols: str, points: int = 20):
    """
    Provides historical data for a list of symbols.
    Results are cached for 60 seconds.
    """
    symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
    # Add reasonable limits
    symbol_list = symbol_list[:50]
    points = min(max(points, 5), 100)
    return await market_data_service.get_history_cached_async(symbol_list, points)

# The old /market-data and /market-pulse endpoints can be deprecated
# as /market-overview provides a more comprehensive snapshot.
# They are kept here for now to not break the frontend immediately.

@router.get("/market-data")
async def get_legacy_market_data(tickers: str = 'BTC-USD,AAPL,IAM'):
    """Legacy endpoint. Prefers /market-overview."""
    ticker_list = [s.strip() for s in tickers.split(',') if s.strip()]
    snapshot = await market_data_service.get_yahoo_snapshot_async(ticker_list)
    # Extract just the prices for the old format
    prices = {ticker: data.get('price') for ticker, data in snapshot.items()}
    return prices
