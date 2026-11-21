from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from app.ai.pipeline import StructuredOutputPipeline

Input = TypeVar("Input")
Output = TypeVar("Output")


class AIFeatureService(ABC, Generic[Input, Output]):
    """Template for a prompt-based AI feature."""

    def __init__(self, pipeline: StructuredOutputPipeline) -> None:
        self.pipeline = pipeline

    @abstractmethod
    def build_prompt(self, *args: Any, **kwargs: Any) -> tuple[str, str]:
        """Return the system instruction and user prompt."""

    @property
    @abstractmethod
    def output_model(self) -> type[BaseModel]:
        """Return the Pydantic model used for structured output."""

    @abstractmethod
    def post_process(
        self,
        result: BaseModel,
        *args: Any,
        **kwargs: Any,
    ) -> Output:
        """Apply feature-specific business validation."""

    def execute(self, *args: Any, **kwargs: Any) -> Output:
        system, prompt = self.build_prompt(*args, **kwargs)
        result = self.pipeline.run(system, prompt, self.output_model)
        return self.post_process(result, *args, **kwargs)
