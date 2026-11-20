from pydantic import Field, field_validator

from app.ai.schemas.common import (
    AIOutputModel,
    Description,
    Title,
    normalize_description,
    strip_title,
)


class SubtaskSuggestion(AIOutputModel):
    title: Title
    description: Description

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_subtask_description(cls, value: object) -> object:
        return normalize_description(value)


class BreakdownOutput(AIOutputModel):
    subtasks: list[SubtaskSuggestion] = Field(min_length=3, max_length=8)
