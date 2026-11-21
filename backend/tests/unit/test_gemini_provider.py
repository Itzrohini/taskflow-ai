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


def create_settings(
    api_key: str = "unit-test-key",
    model: str = "gemini-test-model",
) -> Settings:
    return Settings(
        _env_file=None,
        GEMINI_API_KEY=api_key,
        GEMINI_MODEL=model,
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


def test_gemini_provider_sends_sanitized_json_schema_and_minimal_thinking():
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.return_value = SimpleNamespace(text='{"ok":true}')
    provider = GeminiProvider(create_settings(model="gemini-2.5-flash"))
    schema = {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "minLength": 15,
                "maxLength": 2000,
                "pattern": "ignored-by-provider",
            }
        },
        "required": ["description"],
        "additionalProperties": False,
    }

    with patch("app.ai.providers.gemini.genai.Client", return_value=client):
        provider.generate_json(
            "system",
            "prompt",
            timeout_s=2,
            schema=schema,
            minimize_thinking=True,
            max_output_tokens=512,
        )

    config = client.models.generate_content.call_args.kwargs["config"]
    assert config.response_json_schema == {
        "type": "object",
        "properties": {"description": {"type": "string"}},
        "required": ["description"],
        "additionalProperties": False,
    }
    assert config.response_schema is None
    assert config.thinking_config.thinking_budget == 0
    assert config.thinking_config.thinking_level is None
    assert config.max_output_tokens == 512
    schema_keys = set()

    def collect_keys(value):
        if isinstance(value, dict):
            schema_keys.update(value)
            for nested in value.values():
                collect_keys(nested)
        elif isinstance(value, list):
            for nested in value:
                collect_keys(nested)

    collect_keys(config.response_json_schema)
    assert {"minLength", "maxLength", "pattern"}.isdisjoint(schema_keys)


def test_gemini_provider_retries_schema_rejection_in_plain_json_mode():
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.side_effect = [
        APIError(400, {"error": {"message": "schema unsupported"}}),
        SimpleNamespace(text='{"description":"valid JSON fallback"}'),
    ]
    provider = GeminiProvider(create_settings(model="gemini-3.1-flash-lite"))
    schema = {"type": "object", "properties": {"description": {"type": "string"}}}

    with patch("app.ai.providers.gemini.genai.Client", return_value=client):
        result = provider.generate_json(
            "system",
            "prompt",
            timeout_s=2,
            schema=schema,
            minimize_thinking=True,
            max_output_tokens=512,
        )

    assert result == '{"description":"valid JSON fallback"}'
    assert client.models.generate_content.call_count == 2
    first_config = client.models.generate_content.call_args_list[0].kwargs["config"]
    retry_config = client.models.generate_content.call_args_list[1].kwargs["config"]
    assert first_config.response_json_schema == schema
    assert retry_config.response_json_schema is None
    assert retry_config.response_mime_type == "application/json"
    assert retry_config.system_instruction == "system"
    assert retry_config.temperature == 0.2
    assert retry_config.max_output_tokens == 512
    assert retry_config.thinking_config.thinking_level.value == "MINIMAL"


def test_gemini_provider_logs_and_reraises_unexpected_type_error(caplog):
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.side_effect = TypeError("invalid SDK argument")
    provider = GeminiProvider(create_settings())

    with (
        patch("app.ai.providers.gemini.genai.Client", return_value=client),
        caplog.at_level("ERROR", logger="app.ai.providers.gemini"),
        pytest.raises(TypeError, match="invalid SDK argument"),
    ):
        provider.generate_json("system", "prompt", timeout_s=2)

    assert "Unexpected Gemini client failure (TypeError)" in caplog.text
    assert "Traceback" in caplog.text


def test_gemini_3_uses_only_minimal_thinking_level():
    client = MagicMock()
    client.__enter__.return_value = client
    client.models.generate_content.return_value = SimpleNamespace(text='{"ok":true}')
    provider = GeminiProvider(create_settings(model="gemini-3-flash-preview"))

    with patch("app.ai.providers.gemini.genai.Client", return_value=client):
        provider.generate_json(
            "system", "prompt", timeout_s=2, minimize_thinking=True
        )

    thinking_config = client.models.generate_content.call_args.kwargs[
        "config"
    ].thinking_config
    assert thinking_config.thinking_level.value == "MINIMAL"
    assert thinking_config.thinking_budget is None


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
        pytest.raises(AIProviderError) as raised,
    ):
        provider.generate_json("system", "prompt", timeout_s=2)

    assert "HTTP 404" in caplog.text
    assert "NOT_FOUND" in caplog.text
    assert "private provider message" not in caplog.text
    assert "unit-test-key" not in caplog.text
    assert raised.value.retryable is False
