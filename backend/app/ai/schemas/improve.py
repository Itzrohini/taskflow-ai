from datetime import date
from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.ai.schemas.common import AIOutputModel, strip_nonempty_text, strip_title

ImproveTitle = Annotated[str, Field(min_length=3, max_length=80)]
ImproveDescription = Annotated[str, Field(min_length=15, max_length=2000)]


class ImprovedTask(AIOutputModel):
    title: ImproveTitle
    description: ImproveDescription
    priority: Literal["low", "medium", "high"]
    due_date: date | None

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_task_description(cls, value: object) -> object:
        return strip_nonempty_text(value)
