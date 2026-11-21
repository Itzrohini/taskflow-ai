import re
import time
from datetime import date
from typing import Any

from app.ai.errors import AIInvalidOutputError
from app.ai.pipeline import run_structured
from app.ai.prompts import improve
from app.ai.provider import AIProvider
from app.ai.schemas.improve import ImprovedTask

_DESCRIPTION_CORRECTION_NOTE = (
    "description is required: write 1-2 sentences stating the concrete outcome "
    "or done-criteria, using only facts from the task text"
)
_VERB_FIRST_ACTIONS = frozenset(
    {
        "add",
        "analyze",
        "archive",
        "ask",
        "assign",
        "audit",
        "automate",
        "back",
        "build",
        "calculate",
        "call",
        "capture",
        "categorize",
        "check",
        "clean",
        "clear",
        "close",
        "collect",
        "compare",
        "complete",
        "configure",
        "contact",
        "copy",
        "create",
        "debug",
        "decide",
        "define",
        "delete",
        "deploy",
        "describe",
        "design",
        "develop",
        "diagnose",
        "document",
        "draft",
        "edit",
        "email",
        "establish",
        "estimate",
        "evaluate",
        "explain",
        "export",
        "find",
        "fix",
        "follow",
        "format",
        "gather",
        "generate",
        "get",
        "implement",
        "improve",
        "inspect",
        "install",
        "investigate",
        "launch",
        "learn",
        "list",
        "maintain",
        "make",
        "manage",
        "measure",
        "migrate",
        "monitor",
        "move",
        "organize",
        "outline",
        "package",
        "plan",
        "polish",
        "prepare",
        "prioritize",
        "process",
        "publish",
        "read",
        "record",
        "reduce",
        "refactor",
        "remove",
        "rename",
        "repair",
        "replace",
        "report",
        "research",
        "resolve",
        "review",
        "run",
        "save",
        "schedule",
        "search",
        "send",
        "set",
        "share",
        "simplify",
        "solve",
        "sort",
        "start",
        "submit",
        "summarize",
        "sync",
        "test",
        "track",
        "train",
        "troubleshoot",
        "update",
        "upgrade",
        "validate",
        "verify",
        "write",
    }
)

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


def _is_verb_first_title(title: str) -> bool:
    first_word = re.match(r"[a-z]+", title.casefold())
    return first_word is not None and first_word.group() in _VERB_FIRST_ACTIONS


def _needs_title_retry(input_title: str, output_title: str) -> bool:
    normalized_input = input_title.strip()
    return (
        output_title.casefold() == normalized_input.casefold()
        and (
            len(normalized_input) < 40
            or not _is_verb_first_title(normalized_input)
        )
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
    schema = ImprovedTask.model_json_schema()
    result = run_structured(
        provider,
        improve.SYSTEM,
        prompt,
        ImprovedTask,
        timeout_s=timeout_s,
        correction_note=_DESCRIPTION_CORRECTION_NOTE,
        schema=schema,
        minimize_thinking=True,
        max_output_tokens=512,
    )
    if _needs_title_retry(title, result.title):
        remaining = deadline - time.monotonic()
        if remaining > 0:
            try:
                improved = run_structured(
                    provider,
                    improve.SYSTEM,
                    f"{prompt}\n\nCorrection: The title repeats the input. "
                    "Rewrite it as a clearer, more specific verb-first action "
                    "that preserves the task's intent.",
                    ImprovedTask,
                    timeout_s=remaining,
                    max_attempts=1,
                    schema=schema,
                    minimize_thinking=True,
                    max_output_tokens=512,
                )
            except AIInvalidOutputError:
                pass
            else:
                result = improved

    text = f"{title}\n{description or ''}"
    return {
        "title": result.title,
        "description": result.description,
        "priority": result.priority,
        "due_date": result.due_date if _DATE_REFERENCE.search(text) else None,
    }
