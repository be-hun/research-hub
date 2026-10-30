"""The only module that calls a model API. Swap the provider here without touching the rest of the app.

Credentials come from the environment (ANTHROPIC_API_KEY in backend/.env); they never reach the frontend.
"""

import json
import os

import anthropic

from app import config  # noqa: F401  (loads backend/.env before the settings below are read)

MODEL = os.environ.get("AI_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("AI_EFFORT", "medium")  # low | medium | high | xhigh | max

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
    "additionalProperties": False,
}


class AIUnavailable(Exception):
    """The model could not be reached or is not configured. The message is safe to show users."""


_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def grounded_answer(system: str, messages: list[dict]) -> dict:
    """Return {"answerable", "answer", "cited_records"}, or answerable=False if the model declines."""
    try:
        response = _get_client().beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=system,
            messages=messages,
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
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
        return {"answerable": False, "answer": "I can't help with that request.", "cited_records": []}
    if response.stop_reason == "max_tokens":
        raise AIUnavailable("The assistant's answer was cut off. Try a narrower question.")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AIUnavailable("The assistant returned an empty answer.")
    return json.loads(text)
