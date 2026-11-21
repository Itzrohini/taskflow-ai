from datetime import date
from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.ai.schemas.common import (
    AIOutputModel,
    Description,
    normalize_description,
    strip_title,
)

ImproveTitle = Annotated[str, Field(min_length=1, max_length=80)]


class ImprovedTask(AIOutputModel):
    title: ImproveTitle
    description: Description
    priority: Literal["low", "medium", "high"]
    due_date: date | None

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_task_description(cls, value: object) -> object:
        return normalize_description(value)
