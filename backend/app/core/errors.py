import logging
import re

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)
_MONGODB_URI_PATTERN = re.compile(r"mongodb(?:\+srv)?://[^\s\"'<>]+", re.IGNORECASE)


def log_pymongo_error(context: str, exc: PyMongoError) -> None:
    """Log MongoDB diagnostics while redacting any connection URI."""
    message = _MONGODB_URI_PATTERN.sub("[REDACTED_MONGODB_URI]", str(exc))
    logger.warning("%s failed (%s): %s", context, type(exc).__name__, message)


class DatabaseUnavailableError(Exception):
    """Raised when an operation requires a database connection but the database is unavailable."""

    def __init__(self, message: str = "Database is unavailable") -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(Exception):
    """Raised when a requested task or subtask does not exist."""

    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message)
        self.message = message


async def database_unavailable_exception_handler(
    request: Request, exc: DatabaseUnavailableError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database is unavailable"},
    )


async def not_found_exception_handler(
    request: Request, exc: NotFoundError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": exc.message},
    )


async def pymongo_exception_handler(
    request: Request, exc: PyMongoError
) -> JSONResponse:
    log_pymongo_error("MongoDB request", exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database is unavailable"},
    )
