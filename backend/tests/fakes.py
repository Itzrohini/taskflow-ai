from typing import Any

from app.ai.provider import AIProvider


class ScriptedFakeProvider(AIProvider):
    def __init__(self, responses: list[str | BaseException]) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, object]] = []

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
        self.calls.append(
            {
                "system": system,
                "prompt": prompt,
                "timeout_s": timeout_s,
                "schema": schema,
                "minimize_thinking": minimize_thinking,
                "max_output_tokens": max_output_tokens,
            }
        )
        if not self.responses:
            raise AssertionError("FakeProvider has no scripted response remaining")
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response
