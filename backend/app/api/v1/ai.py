from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.ai.pipeline import StructuredOutputPipeline
from app.ai.provider import AIProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.services.breakdown_service import BreakdownService
from app.ai.services.improve_service import ImproveService
from app.ai.services.plan_service import PlanService
from app.core.config import get_settings
from app.core.rate_limit import enforce_ai_rate_limit
from app.db.mongo import get_database
from app.repositories.task_repository import TaskRepository
from app.schemas.ai import (
    BreakdownRequest,
    BreakdownResponse,
    ImproveRequest,
    ImproveResponse,
    PlanRequest,
    PlanResponse,
)
from app.services.task_service import TaskService

router = APIRouter(dependencies=[Depends(enforce_ai_rate_limit)])


def get_ai_provider() -> AIProvider:
    return GeminiProvider(get_settings())


def get_plan_task_service(
    db: Annotated[Database, Depends(get_database)],
) -> TaskService:
    return TaskService(TaskRepository(db))


def _today_or_utc(today: date | None) -> date:
    return today if today is not None else datetime.now(UTC).date()


@router.post("/breakdown", response_model=BreakdownResponse)
def breakdown(
    request: BreakdownRequest,
    provider: Annotated[AIProvider, Depends(get_ai_provider)],
):
    pipeline = StructuredOutputPipeline(
        provider,
        get_settings().AI_TIMEOUT_SECONDS,
    )
    return BreakdownService(pipeline).execute(
        request.title,
        request.description,
    )


@router.post("/improve", response_model=ImproveResponse)
def improve(
    request: ImproveRequest,
    provider: Annotated[AIProvider, Depends(get_ai_provider)],
):
    pipeline = StructuredOutputPipeline(
        provider,
        get_settings().AI_TIMEOUT_SECONDS,
    )
    return ImproveService(pipeline).execute(
        request.title,
        request.description,
        _today_or_utc(request.today),
    )


@router.post("/plan", response_model=PlanResponse)
def plan(
    request: PlanRequest,
    provider: Annotated[AIProvider, Depends(get_ai_provider)],
    task_service: Annotated[TaskService, Depends(get_plan_task_service)],
):
    today = _today_or_utc(request.today)
    pipeline = StructuredOutputPipeline(
        provider,
        get_settings().AI_TIMEOUT_SECONDS,
    )
    return PlanService(pipeline, task_service).execute(
        today,
        request.available_minutes,
    )
