from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def generate_json(self, system: str, prompt: str, *, timeout_s: float) -> str:
        """Return the raw text generated for a structured response."""
