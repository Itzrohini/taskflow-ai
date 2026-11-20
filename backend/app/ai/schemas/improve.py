from datetime import date
from typing import Literal

from pydantic import field_validator

from app.ai.schemas.common import (
    AIOutputModel,
    Description,
    Title,
    normalize_description,
    strip_title,
)


class ImprovedTask(AIOutputModel):
    title: Title
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
