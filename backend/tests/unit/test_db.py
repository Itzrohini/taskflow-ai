import mongomock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import (
    DatabaseUnavailableError,
    database_unavailable_exception_handler,
)
from app.db.indexes import ensure_indexes
from app.main import create_app


def test_settings_load_without_env(monkeypatch):
    for key in [
        "APP_ENV",
        "CORS_ORIGINS",
        "MONGODB_URI",
        "MONGODB_DB_NAME",
        "MONGODB_TIMEOUT_MS",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "AI_TIMEOUT_SECONDS",
        "AI_RATE_LIMIT_PER_HOUR",
    ]:
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)
    assert settings.APP_ENV == "development"
    assert settings.CORS_ORIGINS == ["http://localhost:3000"]
    assert settings.MONGODB_URI == ""
    assert settings.MONGODB_DB_NAME == "taskflow"
    assert settings.MONGODB_TIMEOUT_MS == 5000
    assert settings.GEMINI_API_KEY is None
    assert settings.GEMINI_MODEL == "gemini-2.5-flash"
    assert settings.AI_TIMEOUT_SECONDS == 20
    assert settings.AI_RATE_LIMIT_PER_HOUR == 30


def test_ensure_indexes_creates_named_indexes_and_is_idempotent():
    mock_client = mongomock.MongoClient()
    db = mock_client.test_taskflow

    created = ensure_indexes(db)
    expected_names = {
        "idx_tasks_completed_due_date",
        "idx_tasks_priority",
        "idx_tasks_created_at_desc",
    }
    expected_keys = {
        "idx_tasks_completed_due_date": [("completed", 1), ("due_date", 1)],
        "idx_tasks_priority": [("priority", 1)],
        "idx_tasks_created_at_desc": [("created_at", -1)],
    }
    assert set(created) == expected_names

    index_info = db.tasks.index_information()
    assert set(index_info) == expected_names | {"_id_"}
    assert {
        name: list(index_info[name]["key"]) for name in expected_names
    } == expected_keys

    ensure_indexes(db)
    index_info_again = db.tasks.index_information()
    assert set(index_info_again) == expected_names | {"_id_"}
    assert {
        name: list(index_info_again[name]["key"]) for name in expected_names
    } == expected_keys


def test_app_boots_with_empty_mongodb_uri(monkeypatch):
    app = create_app()
    with TestClient(app) as test_client:
        response = test_client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_database_unavailable_error_handler():
    test_app = FastAPI()
    test_app.add_exception_handler(
        DatabaseUnavailableError,
        database_unavailable_exception_handler,
    )

    @test_app.get("/trigger-db-error")
    def trigger_error():
        raise DatabaseUnavailableError()

    with TestClient(test_app) as test_client:
        response = test_client.get("/trigger-db-error")
        assert response.status_code == 503
        assert response.json() == {"detail": "Database is unavailable"}
