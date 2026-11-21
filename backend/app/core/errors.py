from fastapi import Request, status
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError


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
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database is unavailable"},
    )
