import re
from datetime import date
from typing import Any

from app.ai.pipeline import run_structured
from app.ai.prompts import improve
from app.ai.provider import AIProvider
from app.ai.schemas.improve import ImprovedTask

_DATE_REFERENCE = re.compile(
    r"\b(?:"
    r"\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?"
    r"|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?"
    r"|today|tomorrow|tonight"
    r"|(?:(?:in|within)(?:\s+the)?\s+)?(?:next\s+)?"
    r"(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
    r"(?:days?|weeks?)"
    r"|(?:end|start|beginning)\s+of\s+(?:the\s+)?(?:week|month|year)"
    r"|(?:this\s+)?weekend"
    r"|(?:next|this)\s+(?:week|month|"
    r"monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday"
    r")\b",
    re.IGNORECASE,
)


def improve_task(
    provider: AIProvider,
    title: str,
    description: str | None,
    today: date,
    *,
    timeout_s: float,
) -> dict[str, Any]:
    result = run_structured(
        provider,
        improve.SYSTEM,
        improve.build_prompt(title, description, today),
        ImprovedTask,
        timeout_s=timeout_s,
    )
    text = f"{title}\n{description or ''}"
    return {
        "title": result.title,
        "description": result.description,
        "priority": result.priority,
        "due_date": result.due_date if _DATE_REFERENCE.search(text) else None,
    }
