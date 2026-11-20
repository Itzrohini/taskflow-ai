from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

Priority = Literal["low", "medium", "high"]
TaskStatus = Literal["all", "pending", "completed"]
DueFilter = Literal["today", "overdue", "upcoming", "none"]
TaskSort = Literal["created_desc", "due_asc"]

TaskTitle = Annotated[str, Field(min_length=1, max_length=200)]
TaskDescription = Annotated[str | None, Field(max_length=2000)]
EstimatedDuration = Annotated[int | None, Field(ge=1, le=1440)]


class TaskSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _strip_title(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _empty_description_to_none(value: object) -> object:
    return None if value == "" else value


def _utc_isoformat(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)
    return value.isoformat().replace("+00:00", "Z")


class SubtaskCreate(TaskSchema):
    title: TaskTitle
    description: TaskDescription = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return _strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return _empty_description_to_none(value)


class SubtaskUpdate(TaskSchema):
    title: TaskTitle = None
    description: TaskDescription = None
    completed: bool = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return _strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return _empty_description_to_none(value)


class SubtasksAddRequest(TaskSchema):
    subtasks: list[SubtaskCreate] = Field(min_length=1, max_length=30)


class TaskCreate(TaskSchema):
    title: TaskTitle
    description: TaskDescription = None
    priority: Priority = "medium"
    due_date: date | None = None
    estimated_duration: EstimatedDuration = None
    subtasks: list[SubtaskCreate] = Field(default_factory=list, max_length=30)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return _strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return _empty_description_to_none(value)


class TaskUpdate(TaskSchema):
    title: TaskTitle = None
    description: TaskDescription = None
    priority: Priority = None
    due_date: date | None = None
    estimated_duration: EstimatedDuration = None
    completed: bool = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return _strip_title(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return _empty_description_to_none(value)


class SubtaskOut(TaskSchema):
    id: str
    title: str
    description: str | None
    completed: bool
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _utc_isoformat(value) or ""


class TaskOut(TaskSchema):
    id: str
    title: str
    description: str | None
    priority: Priority
    completed: bool
    due_date: date | None
    estimated_duration: int | None
    subtasks: list[SubtaskOut]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    @field_serializer("created_at", "updated_at", "completed_at")
    def serialize_datetimes(self, value: datetime | None) -> str | None:
        return _utc_isoformat(value)


class TaskListOut(TaskSchema):
    items: list[TaskOut]
    total: int


class PriorityCounts(TaskSchema):
    low: int
    medium: int
    high: int


class StatsOut(TaskSchema):
    total: int
    completed: int
    pending: int
    overdue: int
    due_today: int
    completion_rate: float
    pending_by_priority: PriorityCounts
