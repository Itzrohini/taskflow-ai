import logging
import math

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


class GeminiProvider(AIProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate_json(self, system: str, prompt: str, *, timeout_s: float) -> str:
        api_key = self.settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise AINotConfiguredError()
        if timeout_s <= 0:
            raise AITimeoutError()

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json",
            automatic_continuation=False,
            http_options=types.HttpOptions(
                timeout=max(1, math.ceil(timeout_s * 1000)),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
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
