from datetime import UTC, date, datetime
from typing import Any, Protocol
from uuid import uuid4

from app.schemas.task import (
    SubtaskCreate,
    SubtaskUpdate,
    TaskCreate,
    TaskUpdate,
)


class TaskStore(Protocol):
    """Persistence boundary used by TaskService."""

    def create(self, document: dict[str, Any]) -> dict[str, Any]: ...
    def get(self, task_id: str) -> dict[str, Any]: ...
    def update(self, task_id: str, updates: dict[str, Any]) -> dict[str, Any]: ...
    def delete(self, task_id: str) -> None: ...
    def add_subtasks(
        self,
        task_id: str,
        subtasks: list[dict[str, Any]],
        updated_at: datetime,
    ) -> dict[str, Any]: ...
    def update_subtask(
        self,
        task_id: str,
        subtask_id: str,
        updates: dict[str, Any],
        updated_at: datetime,
    ) -> dict[str, Any]: ...
    def delete_subtask(
        self,
        task_id: str,
        subtask_id: str,
        updated_at: datetime,
    ) -> dict[str, Any]: ...
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
    ) -> tuple[list[dict[str, Any]], int]: ...
    def stats(self, today: date) -> dict[str, Any]: ...


def utc_now() -> datetime:
    return datetime.now(UTC)


class TaskService:
    """Coordinates task business rules and persistence operations."""

    def __init__(self, store: TaskStore) -> None:
        self.store = store

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
        return self.store.create(document)

    def get(self, task_id: str) -> dict[str, Any]:
        return self.store.get(task_id)

    def update(self, task_id: str, task: TaskUpdate) -> dict[str, Any]:
        updates = task.model_dump(exclude_unset=True)
        if "due_date" in updates:
            due_date = updates["due_date"]
            updates["due_date"] = due_date.isoformat() if due_date is not None else None

        now = utc_now()
        updates["updated_at"] = now
        if "completed" in updates:
            updates["completed_at"] = now if updates["completed"] else None
        return self.store.update(task_id, updates)

    def delete(self, task_id: str) -> None:
        self.store.delete(task_id)

    def add_subtasks(
        self, task_id: str, subtasks: list[SubtaskCreate]
    ) -> dict[str, Any]:
        now = utc_now()
        documents = [self._new_subtask(subtask, now) for subtask in subtasks]
        return self.store.add_subtasks(task_id, documents, now)

    def update_subtask(
        self, task_id: str, subtask_id: str, subtask: SubtaskUpdate
    ) -> dict[str, Any]:
        updates = subtask.model_dump(exclude_unset=True)
        return self.store.update_subtask(
            task_id, subtask_id, updates, utc_now()
        )

    def delete_subtask(self, task_id: str, subtask_id: str) -> dict[str, Any]:
        return self.store.delete_subtask(task_id, subtask_id, utc_now())

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
        items, total = self.store.list(
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
        stats = self.store.stats(today)
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
