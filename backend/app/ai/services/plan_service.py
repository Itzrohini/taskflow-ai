from datetime import date, datetime
from typing import Any

from pydantic import model_validator

from app.ai.pipeline import run_structured
from app.ai.prompts import plan
from app.ai.provider import AIProvider
from app.ai.schemas.plan import PlanDraft

MAX_PENDING_TASKS = 50
_OVER_CAP_WARNING = "Only the first 50 pending tasks were considered."
_TIME_WARNING = "Estimated pending work exceeds available time."


def _due_date_value(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None


def _make_plan_model(
    task_ids: set[str], available_minutes: int
) -> type[PlanDraft]:
    class ContextualPlanDraft(PlanDraft):
        @model_validator(mode="after")
        def validate_context(self):
            seen: set[str] = set()
            for item in [*self.plan, *self.postponed]:
                if item.task_id not in task_ids:
                    raise ValueError("The plan contains an unknown task id")
                if item.task_id in seen:
                    raise ValueError("A task appears more than once")
                seen.add(item.task_id)
            if self.total_minutes > available_minutes:
                raise ValueError("The plan exceeds available time")
            return self

    return ContextualPlanDraft


def create_daily_plan(
    provider: AIProvider,
    pending_tasks: list[dict[str, Any]],
    *,
    total_pending: int,
    today: date,
    available_minutes: int,
    timeout_s: float,
) -> dict[str, Any]:
    if not pending_tasks:
        return {
            "summary": "There are no pending tasks to plan today.",
            "plan": [],
            "postponed": [],
            "warnings": [],
            "total_minutes": 0,
        }

    prompt_tasks = []
    task_by_id: dict[str, dict[str, Any]] = {}
    estimated_minutes = 0
    for task in pending_tasks[:MAX_PENDING_TASKS]:
        task_id = str(task["id"])
        due_date = _due_date_value(task.get("due_date"))
        prompt_task = {
            "task_id": task_id,
            "title": str(task["title"]),
            "priority": task["priority"],
            "due_date": due_date.isoformat() if due_date is not None else None,
            "estimated_duration": task.get("estimated_duration"),
            "subtask_count": len(task.get("subtasks") or []),
            "completed_subtask_count": sum(
                bool(subtask.get("completed"))
                for subtask in task.get("subtasks") or []
            ),
            "overdue": due_date is not None and due_date < today,
            "due_today": due_date == today,
        }
        prompt_tasks.append(prompt_task)
        task_by_id[task_id] = {
            **task,
            "due_date": due_date,
        }
        duration = task.get("estimated_duration")
        if type(duration) is int:
            estimated_minutes += duration

    output_model = _make_plan_model(set(task_by_id), available_minutes)
    draft = run_structured(
        provider,
        plan.SYSTEM,
        plan.build_prompt(prompt_tasks, today, available_minutes),
        output_model,
        timeout_s=timeout_s,
    )

    used_ids: set[str] = set()
    planned = []
    for item in draft.plan:
        task = task_by_id[item.task_id]
        due_date = task["due_date"]
        planned.append(
            {
                "task_id": item.task_id,
                "title": task["title"],
                "priority": task["priority"],
                "due_date": due_date,
                "minutes": item.minutes,
                "reason": item.reason,
            }
        )
        used_ids.add(item.task_id)

    postponed = []
    for item in draft.postponed:
        task = task_by_id[item.task_id]
        postponed.append(
            {
                "task_id": item.task_id,
                "title": task["title"],
                "reason": item.reason,
            }
        )
        used_ids.add(item.task_id)

    for task_id, task in task_by_id.items():
        if task_id not in used_ids:
            postponed.append(
                {
                    "task_id": task_id,
                    "title": task["title"],
                    "reason": "Not scheduled today",
                }
            )

    server_warnings = []
    if total_pending > len(prompt_tasks):
        server_warnings.append(_OVER_CAP_WARNING)
    if estimated_minutes > available_minutes and _TIME_WARNING not in draft.warnings:
        server_warnings.append(_TIME_WARNING)
    warnings = [
        *draft.warnings[: max(0, 20 - len(server_warnings))],
        *server_warnings,
    ]

    return {
        "summary": draft.summary,
        "plan": planned,
        "postponed": postponed,
        "warnings": warnings,
        "total_minutes": draft.total_minutes,
    }
