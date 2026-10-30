"""The only module that calls a model API. Swap the provider here without touching the rest of the app.

Set AI_PROVIDER in backend/.env to "gemini" (default) or "anthropic". Credentials come from the
environment (GEMINI_API_KEY or ANTHROPIC_API_KEY) and never reach the frontend.
"""

import json
import os

from app import config  # noqa: F401  (loads backend/.env before the settings below are read)

PROVIDER = os.environ.get("AI_PROVIDER", "gemini").lower()
DEFAULT_MODELS = {"gemini": "gemini-3.5-flash-lite", "anthropic": "claude-opus-5-5"}
MODEL = os.environ.get("AI_MODEL") or DEFAULT_MODELS.get(PROVIDER, "")
EFFORT = os.environ.get("AI_EFFORT", "medium")  # Anthropic only: low | medium | high | xhigh | max

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answerable": {
            "type": "boolean",
            "description": "False when the provided records do not contain the answer.",
        },
        "answer": {"type": "string"},
        "cited_records": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "Numbers of the records the answer relies on.",
        },
    },
    "required": ["answerable", "answer", "cited_records"],
}

DECLINED = {"answerable": False, "answer": "I can't help with that request.", "cited_records": []}


class AIUnavailable(Exception):
    """The model could not be reached or is not configured. The message is safe to show users."""


def grounded_answer(system: str, messages: list[dict]) -> dict:
    """Return {"answerable", "answer", "cited_records"}, or answerable=False if the model declines.

    messages: [{"role": "user" | "assistant", "content": str}, ...], ending with the user.
    """
    if PROVIDER == "gemini":
        return _gemini(system, messages)
    if PROVIDER == "anthropic":
        return _anthropic(system, messages)
    raise AIUnavailable(f"Unknown AI_PROVIDER '{PROVIDER}'. Use 'gemini' or 'anthropic'.")


# ---------- Gemini ----------

_gemini_client = None


def _network_errors() -> tuple[type[BaseException], ...]:
    errors: list[type[BaseException]] = []
    for name in ("httpx", "httpx2"):
        try:
            errors.append(__import__(name).TransportError)
        except (ImportError, AttributeError):
            pass
    return tuple(errors)


def _gemini(system: str, messages: list[dict]) -> dict:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types

    global _gemini_client
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise AIUnavailable("The assistant is not configured: set GEMINI_API_KEY in backend/.env.")
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=key)

    contents = [
        types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
        for m in messages
    ]
    try:
        response = _gemini_client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_json_schema=ANSWER_SCHEMA,
                max_output_tokens=8192,
            ),
        )
    except genai_errors.ClientError as exc:
        if exc.code in (400, 401, 403) and "key" in str(exc).lower():
            raise AIUnavailable("The assistant is not configured: the Gemini API key was rejected.") from exc
        if exc.code == 404:
            raise AIUnavailable(f"The Gemini model '{MODEL}' was not found. Check AI_MODEL in backend/.env.") from exc
        if exc.code == 429:
            raise AIUnavailable("The assistant is busy or over its free quota. Try again in a minute.") from exc
        raise AIUnavailable(f"The assistant service rejected the request ({exc.code}).") from exc
    except genai_errors.ServerError as exc:
        raise AIUnavailable(f"The assistant service returned an error ({exc.code}).") from exc
    except _network_errors() as exc:
        raise AIUnavailable("The assistant service could not be reached.") from exc

    if response.prompt_feedback and response.prompt_feedback.block_reason:
        return DECLINED
    candidate = response.candidates[0] if response.candidates else None
    if candidate is None:
        raise AIUnavailable("The assistant returned an empty answer.")
    reason = candidate.finish_reason
    if reason == types.FinishReason.MAX_TOKENS:
        raise AIUnavailable("The assistant's answer was cut off. Try a narrower question.")
    if reason not in (None, types.FinishReason.STOP, types.FinishReason.FINISH_REASON_UNSPECIFIED):
        return DECLINED  # safety, recitation, blocklist and similar stops
    if not response.text:
        raise AIUnavailable("The assistant returned an empty answer.")
    try:
        return json.loads(response.text)
    except json.JSONDecodeError as exc:
        raise AIUnavailable("The assistant returned an answer in an unexpected format. Try again.") from exc


# ---------- Anthropic ----------

_anthropic_client = None


def _anthropic(system: str, messages: list[dict]) -> dict:
    import anthropic

    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic()
    try:
        response = _anthropic_client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=system,
            messages=messages,
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": {**ANSWER_SCHEMA, "additionalProperties": False}},
            },
            # On a safety-classifier decline, retry server-side on Anthropic's recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as exc:
        raise AIUnavailable("The assistant is not configured: the API key was rejected.") from exc
    except anthropic.RateLimitError as exc:
        raise AIUnavailable("The assistant is busy right now. Try again in a minute.") from exc
    except anthropic.APIStatusError as exc:
        raise AIUnavailable(f"The assistant service returned an error ({exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        raise AIUnavailable("The assistant service could not be reached.") from exc
    except anthropic.AnthropicError as exc:
        raise AIUnavailable("The assistant service failed unexpectedly.") from exc
    except TypeError as exc:
        # The SDK raises TypeError when it finds no credentials at all; let any other TypeError surface as a bug.
        if "authentication" not in str(exc):
            raise
        raise AIUnavailable("The assistant is not configured: set ANTHROPIC_API_KEY in backend/.env.") from exc

    if response.stop_reason == "refusal":
        return DECLINED
    if response.stop_reason == "max_tokens":
        raise AIUnavailable("The assistant's answer was cut off. Try a narrower question.")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AIUnavailable("The assistant returned an empty answer.")
    return json.loads(text)
