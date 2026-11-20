from typing import Any

from app.ai.errors import AIInvalidOutputError
from app.ai.pipeline import run_structured
from app.ai.prompts import breakdown
from app.ai.provider import AIProvider
from app.ai.schemas.breakdown import BreakdownOutput


def break_down_task(
    provider: AIProvider,
    title: str,
    description: str | None,
    *,
    timeout_s: float,
) -> dict[str, Any]:
    result = run_structured(
        provider,
        breakdown.SYSTEM,
        breakdown.build_prompt(title, description),
        BreakdownOutput,
        timeout_s=timeout_s,
    )

    unique_subtasks = []
    seen_titles: set[str] = set()
    for subtask in result.subtasks:
        normalized_title = subtask.title.casefold()
        if normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)
        unique_subtasks.append(subtask.model_dump())

    if not 3 <= len(unique_subtasks) <= 8:
        raise AIInvalidOutputError()
    return {"subtasks": unique_subtasks}
