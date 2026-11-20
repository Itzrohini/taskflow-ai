import logging
from typing import TYPE_CHECKING

from pymongo import ASCENDING, DESCENDING, IndexModel

if TYPE_CHECKING:
    from pymongo.database import Database

logger = logging.getLogger(__name__)


def ensure_indexes(db: "Database") -> list[str]:
    """Idempotently ensure required indexes exist on the tasks collection.

    Explicit named indexes:
    - idx_tasks_completed_due_date: (completed asc, due_date asc)
    - idx_tasks_priority: (priority asc)
    - idx_tasks_created_at_desc: (created_at desc)
    """
    indexes = [
        IndexModel(
            [("completed", ASCENDING), ("due_date", ASCENDING)],
            name="idx_tasks_completed_due_date",
        ),
        IndexModel(
            [("priority", ASCENDING)],
            name="idx_tasks_priority",
        ),
        IndexModel(
            [("created_at", DESCENDING)],
            name="idx_tasks_created_at_desc",
        ),
    ]
    created = db.tasks.create_indexes(indexes)
    logger.info("Ensured indexes on tasks collection: %s", created)
    return created
