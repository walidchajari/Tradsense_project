import os
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import requests


router = APIRouter(prefix="/api", tags=["Chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)
    language: Optional[str] = "fr"


class ChatResponse(BaseModel):
    reply: str


def _system_prompt(language: str) -> str:
    lang = (language or "fr").lower()
    if lang == "ar":
        return (
            "أنت مساعد TradeSense. كن مختصرا وودودا. "
            "قدم معلومات عن المنصة والقواعد والتسعير. "
            "لا تقدم نصائح مالية مخصصة؛ قدّم توعية عامة فقط."
        )
    if lang == "en":
        return (
            "You are the TradeSense assistant. Be concise and friendly. "
            "Provide info about the platform, rules, and pricing. "
            "Do not give personalized financial advice; provide general education only."
        )
    return (
        "Tu es l'assistant TradeSense. Sois concis et chaleureux. "
        "Donne des infos sur la plateforme, les regles et la tarification. "
        "Ne donne pas de conseils financiers personnalises; reste sur l'education generale."
    )


@router.post("/chat/gemini", response_model=ChatResponse)
def chat_gemini(payload: ChatRequest) -> ChatResponse:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash").strip()
    history = payload.messages[-8:]
    system_prompt = _system_prompt(payload.language)
    contents = []
    for message in history:
        role = "model" if message.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message.content}]})

    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": contents,
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API request failed: {exc}")

    if response.status_code != 200:
        detail = response.text.strip() or "Gemini API error"
        raise HTTPException(status_code=502, detail=f"Gemini API error ({response.status_code}): {detail}")

    data = response.json()
    try:
        reply = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, AttributeError, TypeError):
        raise HTTPException(status_code=502, detail="Unexpected Gemini response")

    if not reply:
        raise HTTPException(status_code=502, detail="Empty response from Gemini")

    return ChatResponse(reply=reply)
