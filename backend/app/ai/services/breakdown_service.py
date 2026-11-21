from typing import Any

from app.ai.base_service import AIFeatureService
from app.ai.errors import AIInvalidOutputError
from app.ai.pipeline import StructuredOutputPipeline
from app.ai.prompts import breakdown
from app.ai.provider import AIProvider
from app.ai.schemas.breakdown import BreakdownOutput


class BreakdownService(AIFeatureService[str, dict[str, Any]]):
    """Service that turns a task into ordered subtask suggestions."""

    def build_prompt(
        self,
        title: str,
        description: str | None = None,
    ) -> tuple[str, str]:
        return breakdown.SYSTEM, breakdown.build_prompt(title, description)

    @property
    def output_model(self) -> type[BreakdownOutput]:
        return BreakdownOutput

    def post_process(
        self,
        result: BreakdownOutput,
        title: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        unique_subtasks: list[dict[str, Any]] = []
        seen_titles: set[str] = set()
        for subtask in result.subtasks:
            normalized_title = subtask.title.strip().casefold()
            if normalized_title in seen_titles:
                continue
            seen_titles.add(normalized_title)
            unique_subtasks.append(subtask.model_dump())

        if not 3 <= len(unique_subtasks) <= 8:
            raise AIInvalidOutputError()
        return {"subtasks": unique_subtasks}


def break_down_task(
    provider: AIProvider,
    title: str,
    description: str | None,
    *,
    timeout_s: float,
) -> dict[str, Any]:
    pipeline = StructuredOutputPipeline(provider, timeout_s)
    return BreakdownService(pipeline).execute(title, description)
