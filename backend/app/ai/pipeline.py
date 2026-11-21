import json
import re
import time
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.ai.errors import (
    AIInvalidOutputError,
    AINotConfiguredError,
    AIProviderError,
    AIRateLimitedError,
    AITimeoutError,
)
from app.ai.provider import AIProvider

OutputModel = TypeVar("OutputModel", bound=BaseModel)
_CODE_FENCE = re.compile(r"\A```(?:json)?\s*(.*?)\s*```\Z", re.IGNORECASE | re.DOTALL)
_CORRECTION = (
    "\n\nCorrection: your previous response was not valid JSON matching the "
    "required schema. Return only a corrected JSON object."
)


def _strip_code_fence(raw: str) -> str:
    text = raw.strip()
    match = _CODE_FENCE.fullmatch(text)
    return match.group(1).strip() if match else text


def run_structured(
    provider: AIProvider,
    system: str,
    prompt: str,
    output_model: type[OutputModel],
    *,
    timeout_s: float,
    max_attempts: int = 2,
    correction_note: str | None = None,
    schema: dict[str, Any] | None = None,
    minimize_thinking: bool = False,
    max_output_tokens: int | None = None,
) -> OutputModel:
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least one")
    if timeout_s <= 0:
        raise AITimeoutError()

    attempt_limit = min(max_attempts, 2)
    deadline = time.monotonic() + timeout_s
    current_prompt = prompt

    for attempt in range(attempt_limit):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise AITimeoutError()

        try:
            provider_options: dict[str, Any] = {"timeout_s": remaining}
            if schema is not None:
                provider_options["schema"] = schema
            if minimize_thinking:
                provider_options["minimize_thinking"] = True
            if max_output_tokens is not None:
                provider_options["max_output_tokens"] = max_output_tokens
            raw = provider.generate_json(
                system, current_prompt, **provider_options
            )
        except (AINotConfiguredError, AIRateLimitedError):
            raise
        except (AITimeoutError, AIProviderError):
            if attempt + 1 == attempt_limit:
                raise
            if time.monotonic() >= deadline:
                raise AITimeoutError() from None
            current_prompt = prompt
            continue

        if time.monotonic() >= deadline:
            raise AITimeoutError()

        try:
            if not isinstance(raw, str):
                raise TypeError("Provider output must be text")
            return output_model.model_validate_json(_strip_code_fence(raw))
        except (ValidationError, json.JSONDecodeError, TypeError, ValueError):
            if attempt + 1 == attempt_limit:
                raise AIInvalidOutputError() from None
            current_prompt = (
                f"{prompt}\n\nCorrection: {correction_note}"
                if correction_note
                else prompt + _CORRECTION
            )

    raise AIInvalidOutputError()
