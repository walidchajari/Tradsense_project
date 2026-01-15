import concurrent.futures
import logging
import os
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services import gemini_service


router = APIRouter(prefix="/api", tags=["Chat"])
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)
    message: Optional[str] = None
    language: Optional[str] = "fr"


class ChatResponse(BaseModel):
    reply: str


class ModelListResponse(BaseModel):
    models: List[str]


def _fallback_reply(language: str) -> str:
    message = (os.environ.get("CHAT_FALLBACK_MESSAGE") or "").strip()
    if message:
        return message
    lang = (language or "fr").lower()
    if lang == "ar":
        return "المساعد غير متوفر مؤقتا. حاول مرة أخرى بعد قليل."
    if lang == "en":
        return "The assistant is temporarily unavailable. Please try again shortly."
    return "L'assistant est temporairement indisponible. Reessayez dans un instant."


@router.post("/chat/gemini", response_model=ChatResponse)
def chat_gemini(payload: ChatRequest) -> ChatResponse:
    messages = [{"role": message.role, "content": message.content} for message in payload.messages]
    if not messages and payload.message:
        messages = [{"role": "user", "content": payload.message}]
    if not messages:
        raise HTTPException(status_code=400, detail="Missing chat message")

    timeout_seconds = float(os.environ.get("CHAT_GEMINI_TIMEOUT_SECONDS", "12") or "12")
    use_fallback = os.environ.get("CHAT_ALLOW_FALLBACK", "").strip().lower() in {"1", "true", "yes"}
    language = payload.language or "fr"
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(gemini_service.generate_reply, messages, language)
            reply = future.result(timeout=timeout_seconds)
        return ChatResponse(reply=reply)
    except concurrent.futures.TimeoutError:
        logger.warning("Gemini API request timed out after %.1f seconds", timeout_seconds)
        if use_fallback:
            return ChatResponse(reply=_fallback_reply(language))
        raise HTTPException(status_code=504, detail="Gemini API timeout")
    except RuntimeError as exc:
        logger.error("Gemini runtime error: %s", exc)
        message = str(exc)
        if use_fallback:
            return ChatResponse(reply=_fallback_reply(language))
        raise HTTPException(status_code=502, detail=message)
    except Exception as exc:
        logger.exception("Gemini API request failed: %s", exc)
        if use_fallback:
            return ChatResponse(reply=_fallback_reply(language))
        raise HTTPException(status_code=502, detail=f"Gemini API request failed: {exc}")


@router.get("/chat/gemini/models", response_model=ModelListResponse)
def gemini_models() -> ModelListResponse:
    try:
        models = gemini_service.list_available_models()
    except Exception as exc:
        logger.exception("Gemini list models failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Gemini list models failed: {exc}")
    return ModelListResponse(models=models)
