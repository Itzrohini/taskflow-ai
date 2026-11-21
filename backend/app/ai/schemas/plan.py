import re
from datetime import date
from typing import Annotated, Literal

from pydantic import Field, StrictInt, field_validator, model_validator

from app.ai.schemas.common import (
    AIOutputModel,
    Reason,
    Summary,
    Title,
    strip_nonempty_text,
    strip_title,
)

ShortText = Annotated[str, Field(min_length=1, max_length=500)]
_UNSUPPORTED_CLAIM = re.compile(
    r"\b(?:completed|finished|scheduled\s+in|added\s+to\s+(?:your\s+)?calendar)\b",
    re.IGNORECASE,
)


class PlanDraftItem(AIOutputModel):
    task_id: Annotated[str, Field(min_length=1, max_length=64)]
    title: Title
    priority: Literal["low", "medium", "high"]
    due_date: date | None
    minutes: Annotated[StrictInt, Field(gt=0, le=960)]
    reason: Reason

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value: object) -> object:
        return strip_nonempty_text(value)


class PostponedDraftItem(AIOutputModel):
    task_id: Annotated[str, Field(min_length=1, max_length=64)]
    title: Title
    reason: Reason

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return strip_title(value)

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value: object) -> object:
        return strip_nonempty_text(value)


class PlanDraft(AIOutputModel):
    summary: Summary
    plan: list[PlanDraftItem] = Field(max_length=50)
    postponed: list[PostponedDraftItem] = Field(max_length=50)
    warnings: list[ShortText] = Field(max_length=20)
    total_minutes: Annotated[StrictInt, Field(ge=0, le=960)]

    @field_validator("summary", mode="before")
    @classmethod
    def normalize_summary(cls, value: object) -> object:
        return strip_nonempty_text(value)

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, values: object) -> object:
        if isinstance(values, list):
            return [strip_nonempty_text(value) for value in values]
        return values

    @model_validator(mode="after")
    def total_matches_plan(self):
        if self.total_minutes != sum(item.minutes for item in self.plan):
            raise ValueError("total_minutes must equal the plan minutes")
        return self

    @model_validator(mode="after")
    def summary_reasons_and_warnings_are_future_facing(self):
        text = [
            self.summary,
            *(item.reason for item in self.plan),
            *(item.reason for item in self.postponed),
            *self.warnings,
        ]
        if any(_UNSUPPORTED_CLAIM.search(item) for item in text):
            raise ValueError(
                "Summary, reasons, and warnings cannot claim tasks are done "
                "or scheduled in a calendar"
            )
        return self
