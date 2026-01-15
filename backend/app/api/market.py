from fastapi import APIRouter

from ..services.casablanca_service import get_casablanca_live_data


router = APIRouter(
    prefix="/api",
    tags=["Bourse de Casablanca"],
)


@router.get("/market")
async def get_casablanca_market():
    return get_casablanca_live_data()


async def get_market_overview(minimal: bool = False):
    """
    Backward-compatible wrapper for legacy imports.
    """
    from .market_data import get_market_overview as _market_overview

    return await _market_overview(minimal=minimal)
