"""The only module that calls a model API. Swap the provider here without touching the rest of the app.

Set AI_PROVIDER in backend/.env to "gemini" (default) or "anthropic". Credentials come from the
environment (GEMINI_API_KEY or ANTHROPIC_API_KEY) and never reach the frontend.
"""

import json
import os

from app import config  # noqa: F401  (loads backend/.env before the settings below are read)

PROVIDER = os.environ.get("AI_PROVIDER", "anthropic").lower()
DEFAULT_MODELS = {"gemini": "gemini-3.5-flash-lite", "anthropic": "claude-sonnet-5-5"}
MODEL = os.environ.get("AI_MODEL") or DEFAULT_MODELS.get(PROVIDER, "")
EFFORT = os.environ.get("AI_EFFORT", "medium")  # Anthropic only: low | medium | high | xhigh | max
TIMEOUT_SECONDS = float(os.environ.get("AI_TIMEOUT_SECONDS", "30"))

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answerable": {
            "type": "boolean",
            "description": "False when the provided records do not contain the answer.",
        },
        "mode": {
            "type": "string",
            "enum": ["people", "research", "team"],
            "description": "people: the user wants to find researchers. research: the user wants to know about the work. "
                           "team: the user wants complementary collaborators for a team or grant.",
        },
        "summary": {"type": "string", "description": "One or two short sentences, at most 40 words, citing [n]."},
        "records": {
            "type": "array",
            "description": "research mode: the most relevant records, best first. people mode: empty.",
            "items": {
                "type": "object",
                "properties": {
                    "record": {"type": "integer"},
                    "takeaway": {"type": "string", "description": "At most 15 words: what it is and why it matters here."},
                },
                "required": ["record", "takeaway"],
                "additionalProperties": False,
            },
        },
        "people": {
            "type": "array",
            "description": "people mode: the most relevant Temple researchers, best first. team mode: up to 8 "
                           "complementary researchers, best first, from different colleges where possible. "
                           "research mode: empty.",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Exactly as written in a record."},
                    "focus": {"type": "string", "description": "At most 10 words: what they work on. Team mode: at "
                                                               "most 12 words on what they bring to the team."},
                    "records": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["name", "focus", "records"],
                "additionalProperties": False,
            },
        },
        "follow_ups": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Three short follow-up questions, at most 10 words each, that these records could help answer.",
        },
    },
    "required": ["answerable", "mode", "summary", "records", "people", "follow_ups"],
}

DECLINED = {"answerable": False, "mode": "research", "summary": "I can't help with that request.",
            "records": [], "people": [], "follow_ups": []}


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "Two or three plain sentences, at most 70 words, citing record numbers like [2]. Empty if the "
                           "records don't support a summary.",
        },
        "points": {
            "type": "array",
            "description": "Up to three key points, each at most 20 words, each backed by the records it cites.",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "records": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["text", "records"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "points"],
}

SUMMARY_DECLINED = {"summary": "", "points": []}
SUMMARY_EFFORT = os.environ.get("AI_SUMMARY_EFFORT", "low")  # short, extractive summaries: low effort is enough


class AIUnavailable(Exception):
    """The model could not be reached or is not configured. The message is safe to show users."""


def grounded_answer(system: str, messages: list[dict]) -> dict:
    """Return a dict shaped like ANSWER_SCHEMA, or answerable=False if the model declines.

    messages: [{"role": "user" | "assistant", "content": str}, ...], ending with the user.
    """
    return _call(system, messages, ANSWER_SCHEMA, _validate_response, DECLINED, EFFORT)


def grounded_summary(system: str, content: str) -> dict:
    """Return a dict shaped like SUMMARY_SCHEMA (summary "" if the model declines). One user message, no history."""
    return _call(system, [{"role": "user", "content": content}], SUMMARY_SCHEMA, _validate_summary,
                 SUMMARY_DECLINED, SUMMARY_EFFORT)


def _call(system: str, messages: list[dict], schema: dict, validate, declined: dict, effort: str) -> dict:
    if PROVIDER == "gemini":
        return _gemini(system, messages, schema, validate, declined)
    if PROVIDER == "anthropic":
        return _anthropic(system, messages, schema, validate, declined, effort)
    raise AIUnavailable(f"Unknown AI_PROVIDER '{PROVIDER}'. Use 'gemini' or 'anthropic'.")


def _validate_response(value: object) -> dict:
    if not isinstance(value, dict):
        raise AIUnavailable("The assistant returned an unexpected answer. Try again.")
    required = {"answerable", "mode", "summary", "records", "people", "follow_ups"}
    if not required.issubset(value) or not isinstance(value["summary"], str):
        raise AIUnavailable("The assistant returned an incomplete answer. Try again.")
    if value["mode"] not in ("people", "research", "team"):
        raise AIUnavailable("The assistant returned an invalid answer mode. Try again.")
    if not all(isinstance(value[key], list) for key in ("records", "people", "follow_ups")):
        raise AIUnavailable("The assistant returned an invalid answer. Try again.")
    return value


def _validate_summary(value: object) -> dict:
    if not isinstance(value, dict) or not isinstance(value.get("summary"), str) or not isinstance(value.get("points"), list):
        raise AIUnavailable("The summary came back in an unexpected format. Try again.")
    return value


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


def _gemini(system: str, messages: list[dict], schema: dict, validate, declined: dict) -> dict:
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
                response_json_schema=schema,
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
        return declined
    candidate = response.candidates[0] if response.candidates else None
    if candidate is None:
        raise AIUnavailable("The assistant returned an empty answer.")
    reason = candidate.finish_reason
    if reason == types.FinishReason.MAX_TOKENS:
        raise AIUnavailable("The assistant's answer was cut off. Try a narrower question.")
    if reason not in (None, types.FinishReason.STOP, types.FinishReason.FINISH_REASON_UNSPECIFIED):
        return declined  # safety, recitation, blocklist and similar stops
    if not response.text:
        raise AIUnavailable("The assistant returned an empty answer.")
    try:
        return validate(json.loads(response.text))
    except json.JSONDecodeError as exc:
        raise AIUnavailable("The assistant returned an answer in an unexpected format. Try again.") from exc


# ---------- Anthropic ----------

_anthropic_client = None


def _anthropic(system: str, messages: list[dict], schema: dict, validate, declined: dict, effort: str) -> dict:
    import anthropic

    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(max_retries=1)
    try:
        response = _anthropic_client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=system,
            messages=messages,
            timeout=TIMEOUT_SECONDS,
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": {**schema, "additionalProperties": False}},
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
        return declined
    if response.stop_reason == "max_tokens":
        raise AIUnavailable("The assistant's answer was cut off. Try a narrower question.")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AIUnavailable("The assistant returned an empty answer.")
    try:
        return validate(json.loads(text))
    except json.JSONDecodeError as exc:
        raise AIUnavailable("The assistant returned an answer in an unexpected format. Try again.") from exc
