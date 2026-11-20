from datetime import UTC, date, datetime
from typing import Any
from uuid import uuid4

from app.repositories.task_repository import TaskRepository
from app.schemas.task import (
    SubtaskCreate,
    SubtaskUpdate,
    TaskCreate,
    TaskUpdate,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


class TaskService:
    def __init__(self, repository: TaskRepository) -> None:
        self.repository = repository

    def create(self, task: TaskCreate) -> dict[str, Any]:
        now = utc_now()
        document = task.model_dump(exclude={"subtasks"})
        document["due_date"] = (
            task.due_date.isoformat() if task.due_date is not None else None
        )
        document.update(
            {
                "completed": False,
                "subtasks": [
                    self._new_subtask(subtask, now) for subtask in task.subtasks
                ],
                "created_at": now,
                "updated_at": now,
                "completed_at": None,
            }
        )
        return self.repository.create(document)

    def get(self, task_id: str) -> dict[str, Any]:
        return self.repository.get(task_id)

    def update(self, task_id: str, task: TaskUpdate) -> dict[str, Any]:
        updates = task.model_dump(exclude_unset=True)
        if "due_date" in updates:
            due_date = updates["due_date"]
            updates["due_date"] = due_date.isoformat() if due_date is not None else None

        now = utc_now()
        updates["updated_at"] = now
        if "completed" in updates:
            updates["completed_at"] = now if updates["completed"] else None
        return self.repository.update(task_id, updates)

    def delete(self, task_id: str) -> None:
        self.repository.delete(task_id)

    def add_subtasks(
        self, task_id: str, subtasks: list[SubtaskCreate]
    ) -> dict[str, Any]:
        now = utc_now()
        documents = [self._new_subtask(subtask, now) for subtask in subtasks]
        return self.repository.add_subtasks(task_id, documents, now)

    def update_subtask(
        self, task_id: str, subtask_id: str, subtask: SubtaskUpdate
    ) -> dict[str, Any]:
        updates = subtask.model_dump(exclude_unset=True)
        return self.repository.update_subtask(
            task_id, subtask_id, updates, utc_now()
        )

    def delete_subtask(self, task_id: str, subtask_id: str) -> dict[str, Any]:
        return self.repository.delete_subtask(task_id, subtask_id, utc_now())

    def list(
        self,
        *,
        status: str,
        priority: str | None,
        query: str | None,
        due: str | None,
        today: date,
        sort: str,
        limit: int,
        skip: int,
    ) -> dict[str, Any]:
        items, total = self.repository.list(
            status=status,
            priority=priority,
            query=query,
            due=due,
            today=today,
            sort=sort,
            limit=limit,
            skip=skip,
        )
        return {"items": items, "total": total}

    def stats(self, today: date) -> dict[str, Any]:
        stats = self.repository.stats(today)
        total = stats["total"]
        stats["completion_rate"] = (
            round(stats["completed"] * 100 / total, 1) if total else 0.0
        )
        return stats

    @staticmethod
    def _new_subtask(subtask: SubtaskCreate, created_at: datetime) -> dict[str, Any]:
        return {
            **subtask.model_dump(),
            "id": uuid4().hex,
            "completed": False,
            "created_at": created_at,
        }
