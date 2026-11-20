from uuid import uuid4

import pytest
from pymongo import MongoClient

from app.core.config import get_settings
from app.db.indexes import ensure_indexes


@pytest.mark.integration
def test_mongo_integration():
    settings = get_settings()
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI is not set; skipping the MongoDB integration test.")

    client = MongoClient(
        settings.MONGODB_URI,
        tz_aware=True,
        serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        appname="taskflow-ai-test",
    )

    test_db = None
    try:
        ping_res = client.admin.command("ping")
        assert ping_res.get("ok") == 1.0

        test_db = client[f"taskflow_ai_integration_test_{uuid4().hex}"]

        created_indexes = ensure_indexes(test_db)
        assert len(created_indexes) == 3

        index_info = test_db.tasks.index_information()
        assert "idx_tasks_completed_due_date" in index_info
        assert "idx_tasks_priority" in index_info
        assert "idx_tasks_created_at_desc" in index_info
    finally:
        try:
            if test_db is not None:
                client.drop_database(test_db.name)
        finally:
            client.close()
