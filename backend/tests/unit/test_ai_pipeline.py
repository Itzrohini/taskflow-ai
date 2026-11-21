import time

import pytest
from pydantic import BaseModel, ConfigDict, Field

from app.ai.errors import (
    AIInvalidOutputError,
    AINotConfiguredError,
    AIProviderError,
    AIRateLimitedError,
    AITimeoutError,
)
from app.ai.pipeline import StructuredOutputPipeline, run_structured
from tests.fakes import ScriptedFakeProvider


class SampleOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=20)


def test_pipeline_accepts_valid_json():
    provider = ScriptedFakeProvider(['{"name":"valid"}'])

    result = run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert result.name == "valid"
    assert len(provider.calls) == 1


def test_pipeline_strips_json_code_fences():
    provider = ScriptedFakeProvider(['```json\n{"name":"fenced"}\n```'])

    result = run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert result.name == "fenced"


def test_pipeline_retries_invalid_json_once_and_corrects_prompt():
    provider = ScriptedFakeProvider(["not json", '{"name":"recovered"}'])

    result = run_structured(provider, "system", "original", SampleOutput, timeout_s=2)

    assert result.name == "recovered"
    assert len(provider.calls) == 2
    assert "Correction:" in str(provider.calls[1]["prompt"])


def test_pipeline_passes_schema_and_custom_correction_note():
    schema = {"type": "object", "properties": {"name": {"type": "string"}}}
    note = "description is required: write 1-2 sentences stating the concrete outcome"
    provider = ScriptedFakeProvider(['{"name":""}', '{"name":"recovered"}'])

    result = run_structured(
        provider,
        "system",
        "original",
        SampleOutput,
        timeout_s=2,
        correction_note=note,
        schema=schema,
        minimize_thinking=True,
    )

    assert result.name == "recovered"
    assert provider.calls[0]["schema"] is schema
    assert provider.calls[0]["minimize_thinking"] is True
    assert note in provider.calls[1]["prompt"]


def test_pipeline_fails_after_two_invalid_outputs():
    provider = ScriptedFakeProvider(["bad", "still bad"])

    with pytest.raises(AIInvalidOutputError):
        run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert len(provider.calls) == 2


@pytest.mark.parametrize(
    "output",
    [
        "{}",
        '{"name":42}',
        '{"name":"ok","extra":true}',
    ],
)
def test_pipeline_rejects_missing_wrong_and_extra_fields(output: str):
    provider = ScriptedFakeProvider([output, output])

    with pytest.raises(AIInvalidOutputError):
        run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert len(provider.calls) == 2


def test_pipeline_retries_transient_provider_error():
    provider = ScriptedFakeProvider(
        [AIProviderError(), '{"name":"recovered"}']
    )

    result = run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert result.name == "recovered"
    assert len(provider.calls) == 2


@pytest.mark.parametrize("error", [AINotConfiguredError(), AIRateLimitedError()])
def test_pipeline_does_not_retry_nontransient_errors(error):
    provider = ScriptedFakeProvider([error])

    with pytest.raises(type(error)):
        run_structured(provider, "system", "prompt", SampleOutput, timeout_s=2)

    assert len(provider.calls) == 1


def test_pipeline_enforces_total_time_budget():
    class SlowProvider(ScriptedFakeProvider):
        def generate_json(self, system, prompt, *, timeout_s):
            self.calls.append({"timeout_s": timeout_s})
            time.sleep(0.01)
            return '{"name":"late"}'

    provider = SlowProvider([])
    with pytest.raises(AITimeoutError):
        run_structured(provider, "system", "prompt", SampleOutput, timeout_s=0.001)
    assert len(provider.calls) == 1


def test_structured_output_pipeline_class_retries_and_strips_fences():
    provider = ScriptedFakeProvider(["bad", "```json\n{\"name\":\"class\"}\n```"])
    pipeline = StructuredOutputPipeline(provider, timeout_s=2)

    result = pipeline.run("system", "prompt", SampleOutput)

    assert result.name == "class"
    assert len(provider.calls) == 2
