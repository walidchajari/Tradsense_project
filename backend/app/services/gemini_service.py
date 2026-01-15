import logging
import os
from typing import Dict, List, Optional

from google import genai
from google.genai import types


logger = logging.getLogger(__name__)


def _system_prompt(language: str) -> str:
    lang = (language or "fr").lower()
    if lang == "ar":
        return (
            "أنت مساعد TradeSense. كن مختصرا وودودا. "
            "أجب على أسئلة التداول والتعليم المالي بشكل عام وبأسلوب واضح. "
            "لا تقدم نصائح استثمارية شخصية أو توصيات شراء/بيع مخصصة؛ قدّم توعية عامة فقط."
        )
    if lang == "en":
        return (
            "You are the TradeSense assistant. Be concise and friendly. "
            "Answer trading and financial education questions in a clear, practical way. "
            "Do not provide personalized investment advice or specific buy/sell recommendations; keep it general."
        )
    return (
        "Tu es l'assistant TradeSense. Sois concis et chaleureux. "
        "Reponds aux questions de trading et d'education financiere de maniere claire et pratique. "
        "Ne donne pas de conseils financiers personnalises ni de recommandations d'achat/vente; reste general."
    )


def _extract_text(response: object) -> str:
    text = (getattr(response, "text", None) or "").strip()
    if text:
        return text
    candidates = getattr(response, "candidates", None)
    if not candidates:
        return ""
    parts: List[str] = []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", []) or []:
            if isinstance(part, dict):
                value = part.get("text")
            else:
                value = getattr(part, "text", None)
            if value:
                parts.append(str(value))
    return "\n".join(parts).strip()


def list_available_models() -> List[str]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")
    client = genai.Client(api_key=api_key)
    models = client.models.list()
    model_names: List[str] = []
    for model in models:
        name = getattr(model, "name", None) or getattr(model, "model", None)
        if name:
            model_names.append(str(name))
    return model_names


def generate_reply(messages: List[Dict[str, str]], language: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")

    model_name = os.environ.get("GEMINI_MODEL", "models/gemini-flash-latest").strip() or "models/gemini-flash-latest"
    if model_name and not model_name.startswith("models/"):
        model_name = f"models/{model_name}"
    history = messages[-8:]
    contents = []
    for message in history:
        role = "model" if message.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message.get("content", "")}]})

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        system_instruction=_system_prompt(language),
        temperature=0.3,
        max_output_tokens=500,
    )
    response: Optional[object] = None
    raw_candidates = [
        model_name,
        "models/gemini-flash-latest",
        "models/gemini-pro-latest",
        "models/gemini-2.0-flash",
        "models/gemini-2.5-flash",
    ]
    seen = set()
    model_candidates = []
    for candidate in raw_candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        model_candidates.append(candidate)
    last_error: Optional[Exception] = None
    for candidate in model_candidates:
        if response is not None:
            break
        try:
            response = client.models.generate_content(
                model=candidate,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            last_error = exc
            message = str(exc)
            logger.error("Gemini generate_content failed (%s) for model %s: %s", type(exc).__name__, candidate, exc)
            if "NOT_FOUND" in message:
                continue
            raise
    if response is None and last_error is not None:
        attempted = ", ".join(model_candidates)
        raise RuntimeError(f"Gemini model not available. Tried: {attempted}") from last_error

    reply = _extract_text(response)
    if not reply:
        logger.error("Unexpected Gemini response: %s", response)
        raise RuntimeError("Unexpected Gemini response")
    return reply
