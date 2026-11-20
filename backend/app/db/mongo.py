import logging
from typing import TYPE_CHECKING

from fastapi import Request
from pymongo import MongoClient

from app.core.config import Settings, get_settings
from app.core.errors import DatabaseUnavailableError

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

    Raises DatabaseUnavailableError if the MongoDB client is not configured or initialized.
    Can be overridden in tests via app.dependency_overrides[get_database].
    """
    client: MongoClient | None = getattr(request.app.state, "mongo_client", None)
    if client is None:
        raise DatabaseUnavailableError()
    settings = get_settings()
    return client[settings.MONGODB_DB_NAME]
