from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Title = Annotated[str, Field(min_length=1, max_length=200)]
Description = Annotated[str | None, Field(max_length=2000)]
Reason = Annotated[str, Field(min_length=1, max_length=500)]
Summary = Annotated[str, Field(min_length=1, max_length=1000)]


class AIOutputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def strip_title(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def normalize_description(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def strip_nonempty_text(value: object) -> object:
    return value.strip() if isinstance(value, str) else value
