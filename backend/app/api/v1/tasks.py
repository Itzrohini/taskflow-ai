from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pymongo.database import Database

from app.db.mongo import get_database
from app.repositories.task_repository import TaskRepository
from app.schemas.task import (
    DueFilter,
    Priority,
    StatsOut,
    SubtasksAddRequest,
    SubtaskUpdate,
    TaskCreate,
    TaskListOut,
    TaskOut,
    TaskSort,
    TaskStatus,
    TaskUpdate,
)
from app.services.task_service import TaskService

router = APIRouter()


def get_task_service(
    db: Annotated[Database, Depends(get_database)],
) -> TaskService:
    return TaskService(TaskRepository(db))


def _today_or_utc(today: date | None) -> date:
    return today if today is not None else datetime.now(UTC).date()


@router.post(
    "/",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task: TaskCreate,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.create(task)


@router.get("/", response_model=TaskListOut)
def list_tasks(
    service: Annotated[TaskService, Depends(get_task_service)],
    status_filter: Annotated[TaskStatus, Query(alias="status")] = "all",
    priority: Priority | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    due: DueFilter | None = None,
    today: date | None = None,
    sort: TaskSort = "created_desc",
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    skip: Annotated[int, Query(ge=0)] = 0,
):
    return service.list(
        status=status_filter,
        priority=priority,
        query=q,
        due=due,
        today=_today_or_utc(today),
        sort=sort,
        limit=limit,
        skip=skip,
    )


@router.get("/stats", response_model=StatsOut)
def get_task_stats(
    service: Annotated[TaskService, Depends(get_task_service)],
    today: date | None = None,
):
    return service.stats(_today_or_utc(today))


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: str,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.get(task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    task: TaskUpdate,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.update(task_id, task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_task(
    task_id: str,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> Response:
    service.delete(task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/subtasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def add_subtasks(
    task_id: str,
    body: SubtasksAddRequest,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.add_subtasks(task_id, body.subtasks)


@router.patch(
    "/{task_id}/subtasks/{subtask_id}",
    response_model=TaskOut,
)
def update_subtask(
    task_id: str,
    subtask_id: str,
    subtask: SubtaskUpdate,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.update_subtask(task_id, subtask_id, subtask)


@router.delete(
    "/{task_id}/subtasks/{subtask_id}",
    response_model=TaskOut,
)
def delete_subtask(
    task_id: str,
    subtask_id: str,
    service: Annotated[TaskService, Depends(get_task_service)],
):
    return service.delete_subtask(task_id, subtask_id)
