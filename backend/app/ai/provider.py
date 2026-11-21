from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    @abstractmethod
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
        """Return the raw text generated for a structured response."""
