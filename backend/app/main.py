import logging
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from app.ai.errors import AIError, ai_exception_handler
from app.api.v1.ai import router as ai_router
from app.api.v1.health import router as health_router
from app.api.v1.tasks import router as tasks_router
from app.core.config import get_settings
from app.core.errors import (
    DatabaseUnavailableError,
    NotFoundError,
    database_unavailable_exception_handler,
    log_pymongo_error,
    not_found_exception_handler,
    pymongo_exception_handler,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        with app.state.mongo_lock:
            client = app.state.mongo_client
            app.state.mongo_client = None
            if client is not None:
                try:
                    client.close()
                except (PyMongoError, OSError) as exc:
                    if isinstance(exc, PyMongoError):
                        log_pymongo_error("MongoDB client shutdown", exc)
                    else:
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
    app.state.mongo_client = None
    app.state.mongo_lock = Lock()
    app.state.mongo_indexes_attempted = False

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
    app.add_exception_handler(PyMongoError, pymongo_exception_handler)
    app.add_exception_handler(AIError, ai_exception_handler)

    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(
        tasks_router,
        prefix="/api/v1/tasks",
        tags=["tasks"],
    )
    app.include_router(
        ai_router,
        prefix="/api/v1/ai",
        tags=["ai"],
    )

    return app


app = create_app()
