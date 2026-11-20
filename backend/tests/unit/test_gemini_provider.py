from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from google.genai.errors import APIError

from app.ai.errors import (
    AINotConfiguredError,
    AIProviderError,
    AIRateLimitedError,
    AITimeoutError,
)
from app.ai.providers.gemini import GeminiProvider
from app.core.config import Settings


def create_settings(api_key: str = "unit-test-key") -> Settings:
    return Settings(
        _env_file=None,
        GEMINI_API_KEY=api_key,
        GEMINI_MODEL="gemini-test-model",
    )


def test_empty_api_key_raises_when_provider_is_used():
    provider = GeminiProvider(create_settings(""))

    with patch(
        "app.ai.providers.gemini.genai.Client"
    ) as client_factory, pytest.raises(AINotConfiguredError):
        provider.generate_json("system", "prompt", timeout_s=2)

    client_factory.assert_not_called()


def test_gemini_provider_uses_json_mode_timeout_and_closes_client():
    client = MagicMock()
    client.__enter__.return_value = client
    client.__exit__.side_effect = lambda *args: client.close()
    client.models.generate_content.return_value = SimpleNamespace(text='{"ok":true}')
    provider = GeminiProvider(create_settings())

    with patch("app.ai.providers.gemini.genai.Client", return_value=client) as factory:
        result = provider.generate_json("system", "prompt", timeout_s=1.25)

    assert result == '{"ok":true}'
    factory.assert_called_once_with(api_key="unit-test-key")
    call = client.models.generate_content.call_args.kwargs
    assert call["model"] == "gemini-test-model"
    assert call["contents"] == "prompt"
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].temperature < 1
    assert call["config"].http_options.timeout == 1250
    assert call["config"].http_options.retry_options.attempts == 1
    client.close.assert_called_once()


@pytest.mark.parametrize(
    ("exception", "expected"),
    [
        (
            APIError(
                429,
                {"error": {"message": "private provider message", "status": "RESOURCE_EXHAUSTED"}},
            ),
            AIRateLimitedError,
        ),
        (
            APIError(
                504,
                {"error": {"message": "private provider message", "status": "DEADLINE_EXCEEDED"}},
            ),
            AITimeoutError,
        ),
        (
            APIError(
                503,
                {"error": {"message": "private provider message", "status": "UNAVAILABLE"}},
            ),
            AIProviderError,
        ),
        (TimeoutError("private timeout detail"), AITimeoutError),
    ],
)
def test_gemini_exceptions_map_to_safe_ai_errors(exception, expected):
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.side_effect = exception
    provider = GeminiProvider(create_settings())

    with (
        patch("app.ai.providers.gemini.genai.Client", return_value=client),
        pytest.raises(expected) as raised,
    ):
        provider.generate_json("system", "prompt", timeout_s=2)

    assert "private" not in str(raised.value)


def test_gemini_api_error_logs_status_without_provider_details(caplog):
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.side_effect = APIError(
        404,
        {
            "error": {
                "message": "private provider message",
                "status": "NOT_FOUND",
            }
        },
    )
    provider = GeminiProvider(create_settings())

    with (
        patch("app.ai.providers.gemini.genai.Client", return_value=client),
        caplog.at_level("WARNING", logger="app.ai.providers.gemini"),
        pytest.raises(AIProviderError),
    ):
        provider.generate_json("system", "prompt", timeout_s=2)

    assert "HTTP 404" in caplog.text
    assert "NOT_FOUND" in caplog.text
    assert "private provider message" not in caplog.text
    assert "unit-test-key" not in caplog.text
