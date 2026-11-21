import re
import time
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
    prompt = improve.build_prompt(title, description, today)
    deadline = time.monotonic() + timeout_s
    result = run_structured(
        provider,
        improve.SYSTEM,
        prompt,
        ImprovedTask,
        timeout_s=timeout_s,
    )
    missing_input_description = not (description and description.strip())
    needs_description = missing_input_description and not result.description
    identical_title = result.title.casefold() == title.strip().casefold()
    if needs_description or identical_title:
        corrections = []
        if needs_description:
            corrections.append(
                "The previous description was null or empty. Return a concrete, "
                "non-empty one- or two-sentence description based only on the "
                "user's task text."
            )
        if identical_title:
            corrections.append(
                "The previous title repeated the input. Rewrite it as a clear "
                "verb-first action of at most 80 characters while preserving "
                "the user's intent."
            )
        result = run_structured(
            provider,
            improve.SYSTEM,
            f"{prompt}\n\nCorrection: {' '.join(corrections)}",
            ImprovedTask,
            timeout_s=deadline - time.monotonic(),
            max_attempts=1,
        )

    text = f"{title}\n{description or ''}"
    return {
        "title": result.title,
        "description": result.description,
        "priority": result.priority,
        "due_date": result.due_date if _DATE_REFERENCE.search(text) else None,
    }
