from fastapi import APIRouter

from .extra import (
    accounts,
    ai_predict,
    ai_signals,
    casablanca_companies,
    casablanca_companies_search,
    get_market_pulse,
    news,
    portfolio,
)
from .market import get_market_overview


router = APIRouter(tags=["Compat"])


router.add_api_route(
    "/market-overview",
    get_market_overview,
    methods=["GET"],
    name="compat_market_overview",
)
router.add_api_route(
    "/market-pulse",
    get_market_pulse,
    methods=["GET"],
    name="compat_market_pulse",
)
router.add_api_route("/news", news, methods=["GET"], name="compat_news")
router.add_api_route("/ai/signals", ai_signals, methods=["GET"], name="compat_ai_signals")
router.add_api_route(
    "/ai/predict/{symbol}",
    ai_predict,
    methods=["GET"],
    name="compat_ai_predict",
)
router.add_api_route("/accounts/{user_id}", accounts, methods=["GET"], name="compat_accounts")
router.add_api_route("/portfolio/{user_id}", portfolio, methods=["GET"], name="compat_portfolio")
router.add_api_route(
    "/casablanca/companies",
    casablanca_companies,
    methods=["GET"],
    name="compat_casablanca_companies",
)
router.add_api_route(
    "/casablanca/companies/search",
    casablanca_companies_search,
    methods=["GET"],
    name="compat_casablanca_companies_search",
)
