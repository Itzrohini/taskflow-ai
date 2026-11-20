from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.ai.schemas.common import (
    Description,
    Reason,
    Summary,
    Title,
    normalize_description,
    strip_title,
)

Priority = Literal["low", "medium", "high"]


class AIRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BreakdownRequest(AIRequest):
    title: Title
    description: Description = None

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_task_description(cls, value: object) -> object:
        return normalize_description(value)


class ImproveRequest(AIRequest):
    title: Title
    description: Description = None
    today: date | None = None

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_task_description(cls, value: object) -> object:
        return normalize_description(value)


class PlanRequest(AIRequest):
    available_minutes: Annotated[StrictInt, Field(ge=15, le=960)] = 240
    today: date | None = None


class BreakdownItemResponse(AIRequest):
    title: Title
    description: Description


class BreakdownResponse(AIRequest):
    subtasks: list[BreakdownItemResponse] = Field(min_length=3, max_length=8)


class ImproveResponse(AIRequest):
    title: Title
    description: Description
    priority: Priority
    due_date: date | None


class PlannedTaskResponse(AIRequest):
    task_id: str
    title: Title
    priority: Priority
    due_date: date | None
    minutes: Annotated[StrictInt, Field(gt=0, le=960)]
    reason: Reason


class PostponedTaskResponse(AIRequest):
    task_id: str
    title: Title
    reason: Reason


class PlanResponse(AIRequest):
    summary: Summary
    plan: list[PlannedTaskResponse] = Field(max_length=50)
    postponed: list[PostponedTaskResponse] = Field(max_length=50)
    warnings: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(
        max_length=20
    )
    total_minutes: Annotated[StrictInt, Field(ge=0, le=960)]
