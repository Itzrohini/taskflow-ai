import logging
import math
from typing import Any

import httpx2
from google import genai
from google.genai import errors, types

from app.ai.errors import (
    AINotConfiguredError,
    AIProviderError,
    AIRateLimitedError,
    AITimeoutError,
)
from app.ai.provider import AIProvider
from app.core.config import Settings

logger = logging.getLogger(__name__)

_JSON_SCHEMA_KEYS = frozenset(
    {
        "$id",
        "$defs",
        "$ref",
        "$anchor",
        "type",
        "format",
        "title",
        "description",
        "enum",
        "items",
        "prefixItems",
        "minItems",
        "maxItems",
        "minimum",
        "maximum",
        "anyOf",
        "oneOf",
        "properties",
        "additionalProperties",
        "required",
        "propertyOrdering",
    }
)


def _sanitize_json_schema(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized = {}
        for key, item in value.items():
            if key not in _JSON_SCHEMA_KEYS:
                continue
            if key in {"$defs", "properties"} and isinstance(item, dict):
                sanitized[key] = {
                    name: _sanitize_json_schema(definition)
                    for name, definition in item.items()
                }
            else:
                sanitized[key] = _sanitize_json_schema(item)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_json_schema(item) for item in value]
    return value


def _minimal_thinking_config(model: str) -> types.ThinkingConfig | None:
    if model.startswith("gemini-2.5"):
        return types.ThinkingConfig(thinking_budget=0)
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    return None


class GeminiProvider(AIProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate_json(
        self,
        system: str,
        prompt: str,
        *,
        timeout_s: float,
        schema: dict[str, Any] | None = None,
        minimize_thinking: bool = False,
        max_output_tokens: int | None = None,
    ) -> str:
        api_key = self.settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise AINotConfiguredError()
        if timeout_s <= 0:
            raise AITimeoutError()

        config_options: dict[str, Any] = {}
        if schema is not None:
            config_options["response_json_schema"] = _sanitize_json_schema(schema)
        if minimize_thinking:
            thinking_config = _minimal_thinking_config(self.settings.GEMINI_MODEL)
            if thinking_config is not None:
                config_options["thinking_config"] = thinking_config
        if max_output_tokens is not None:
            config_options["max_output_tokens"] = max_output_tokens

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json",
            automatic_continuation=False,
            http_options=types.HttpOptions(
                timeout=max(1, math.ceil(timeout_s * 1000)),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
            **config_options,
        )
        try:
            with genai.Client(api_key=api_key) as client:
                response = client.models.generate_content(
                    model=self.settings.GEMINI_MODEL,
                    contents=prompt,
                    config=config,
                )
        except (TimeoutError, httpx2.TimeoutException) as exc:
            logger.warning("Gemini request timed out")
            raise AITimeoutError() from exc
        except errors.APIError as exc:
            logger.warning(
                "Gemini API request failed (HTTP %s, status %s)",
                exc.code,
                exc.status or "unknown",
            )
            if exc.code == 429:
                raise AIRateLimitedError() from exc
            if exc.code in (408, 504) or exc.status in {
                "DEADLINE_EXCEEDED",
                "TIMEOUT",
            }:
                raise AITimeoutError() from exc
            raise AIProviderError() from exc
        except httpx2.HTTPError as exc:
            logger.warning(
                "Gemini transport failed (%s)",
                type(exc).__name__,
            )
            raise AIProviderError() from exc
        except Exception as exc:
            logger.error(
                "Unexpected Gemini client failure (%s)",
                type(exc).__name__,
            )
            raise AIProviderError() from exc

        return response.text or ""
