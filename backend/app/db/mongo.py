import logging
from typing import TYPE_CHECKING

from fastapi import Request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.config import Settings, get_settings
from app.core.errors import (
    DatabaseUnavailableError,
    log_pymongo_error,
)
from app.db.indexes import ensure_indexes

if TYPE_CHECKING:
    from pymongo.database import Database

logger = logging.getLogger(__name__)


def create_client(settings: Settings) -> MongoClient:
    """Create a MongoDB client configured from application settings.

    Never logs the URI or credentials.
    """
    logger.info("Initializing MongoDB client (serverSelectionTimeoutMS=%s)", settings.MONGODB_TIMEOUT_MS)
    return MongoClient(
        settings.MONGODB_URI,
        tz_aware=True,
        serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        appname="taskflow-ai",
    )


def get_database(request: Request) -> "Database":
    """FastAPI dependency that returns the database specified in settings.

    Initializes the process client and indexes lazily on the first database request.
    Raises DatabaseUnavailableError when the MongoDB URI is empty or invalid.
    Can be overridden in tests via app.dependency_overrides[get_database].
    """
    settings = get_settings()
    if not settings.MONGODB_URI:
        raise DatabaseUnavailableError()

    state = request.app.state
    client: MongoClient | None = getattr(state, "mongo_client", None)
    if client is None or not state.mongo_indexes_attempted:
        with state.mongo_lock:
            client = state.mongo_client
            if client is None:
                try:
                    client = create_client(settings)
                except (PyMongoError, OSError, ValueError) as exc:
                    if isinstance(exc, PyMongoError):
                        log_pymongo_error("MongoDB client initialization", exc)
                    else:
                        logger.warning(
                            "MongoDB client initialization failed (%s)",
                            type(exc).__name__,
                        )
                    raise DatabaseUnavailableError() from exc
                state.mongo_client = client

            if not state.mongo_indexes_attempted:
                state.mongo_indexes_attempted = True
                try:
                    ensure_indexes(client[settings.MONGODB_DB_NAME])
                except (PyMongoError, OSError) as exc:
                    if isinstance(exc, PyMongoError):
                        log_pymongo_error("Database index creation", exc)
                    else:
                        logger.warning(
                            "Database index creation failed (%s)",
                            type(exc).__name__,
                        )

    return client[settings.MONGODB_DB_NAME]
