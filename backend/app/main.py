import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from app.api.v1.health import router as health_router
from app.api.v1.tasks import router as tasks_router
from app.core.config import get_settings
from app.core.errors import (
    DatabaseUnavailableError,
    NotFoundError,
    database_unavailable_exception_handler,
    not_found_exception_handler,
)
from app.db.indexes import ensure_indexes
from app.db.mongo import create_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = None
    if settings.MONGODB_URI:
        try:
            client = create_client(settings)
            app.state.mongo_client = client
        except (PyMongoError, OSError, ValueError) as exc:
            logger.warning(
                "Failed to initialize MongoDB client at startup (%s)",
                type(exc).__name__,
            )
            app.state.mongo_client = None

        if app.state.mongo_client is not None:
            try:
                db = client[settings.MONGODB_DB_NAME]
                ensure_indexes(db)
            except (PyMongoError, OSError) as exc:
                logger.warning(
                    "Failed to create database indexes at startup (%s)",
                    type(exc).__name__,
                )
    else:
        app.state.mongo_client = None

    yield

    if getattr(app.state, "mongo_client", None) is not None:
        try:
            app.state.mongo_client.close()
        except (PyMongoError, OSError) as exc:
            logger.warning(
                "Error closing MongoDB client at shutdown (%s)",
                type(exc).__name__,
            )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TaskFlow AI",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(
        DatabaseUnavailableError,
        database_unavailable_exception_handler,
    )
    app.add_exception_handler(NotFoundError, not_found_exception_handler)

    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(
        tasks_router,
        prefix="/api/v1/tasks",
        tags=["tasks"],
    )

    return app


app = create_app()
