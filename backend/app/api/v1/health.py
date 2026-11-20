import logging
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.db.mongo import get_database

if TYPE_CHECKING:
    from pymongo.database import Database

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@router.get("/")
def health_check():
    return {"status": "ok"}


@router.get("/db")
def health_db_check(
    db: Annotated["Database", Depends(get_database)],
):
    try:
        db.client.admin.command("ping")
    except (PyMongoError, OSError) as exc:
        logger.warning("Database ping failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Database is unreachable"},
        )
    return {"status": "ok", "database": db.name}
