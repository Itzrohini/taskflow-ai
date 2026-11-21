from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from time import sleep
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pymongo.errors import ConfigurationError, PyMongoError, ServerSelectionTimeoutError

from app.core.config import Settings, get_settings
from app.core.errors import (
    DatabaseUnavailableError,
    database_unavailable_exception_handler,
    pymongo_exception_handler,
)
from app.db.indexes import ensure_indexes
from app.db.mongo import get_database
from app.main import create_app
from app.schemas.task import TaskCreate
from app.services.task_service import TaskService


def _request_for(app: FastAPI) -> Request:
    return Request(
        {
            "type": "http",
            "app": app,
            "method": "GET",
            "path": "/",
            "headers": [],
            "query_string": b"",
            "server": ("test", 80),
            "client": ("test", 1),
            "scheme": "http",
        }
    )


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
    assert settings.GEMINI_API_KEY == ""
    assert settings.GEMINI_MODEL == "gemini-3.5-flash-lite"
    assert settings.AI_TIMEOUT_SECONDS == 20
    assert settings.AI_RATE_LIMIT_PER_HOUR == 100


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


def test_vercel_origin_passes_cors_preflight(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        '["http://localhost:3000","https://taskflow.example.vercel.app"]',
    )
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as test_client:
        response = test_client.options(
            "/api/v1/tasks/",
            headers={
                "Origin": "https://taskflow.example.vercel.app",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
    get_settings.cache_clear()
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "https://taskflow.example.vercel.app"
    )


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


def test_pymongo_error_handler_logs_safe_connection_diagnostics(caplog):
    test_app = FastAPI()
    test_app.add_exception_handler(PyMongoError, pymongo_exception_handler)

    @test_app.get("/trigger-pymongo-error")
    def trigger_pymongo_error():
        raise ServerSelectionTimeoutError(
            "SSL handshake failed; "
            "mongodb+srv://test-user:test-password@example.mongodb.net/taskflow"
        )

    with (
        TestClient(test_app) as test_client,
        caplog.at_level("WARNING", logger="app.core.errors"),
    ):
        response = test_client.get("/trigger-pymongo-error")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}
    assert "SSL handshake failed" in caplog.text
    assert "REDACTED_MONGODB_URI" in caplog.text
    assert "test-user" not in caplog.text
    assert "test-password" not in caplog.text


def test_mongodb_is_not_initialized_during_app_startup(monkeypatch):
    monkeypatch.setattr(
        "app.db.mongo.create_client",
        lambda _settings: pytest.fail("MongoDB must initialize lazily"),
    )
    monkeypatch.setattr(
        "app.db.mongo.ensure_indexes",
        lambda _db: pytest.fail("indexes must initialize lazily"),
    )
    app = create_app()

    with TestClient(app) as test_client:
        response = test_client.get("/health")

    assert response.status_code == 200


def test_mongo_configuration_error_is_redacted_and_returns_503(monkeypatch, caplog):
    def fail_client(_settings):
        raise ConfigurationError(
            "Invalid URI mongodb+srv://test-user:test-password@example.mongodb.net"
        )

    monkeypatch.setattr(
        "app.db.mongo.get_settings",
        lambda: Settings(_env_file=None, MONGODB_URI="invalid"),
    )
    monkeypatch.setattr("app.db.mongo.create_client", fail_client)
    app = create_app()

    with (
        TestClient(app) as test_client,
        caplog.at_level("WARNING", logger="app.core.errors"),
    ):
        response = test_client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}
    assert "Invalid URI" in caplog.text
    assert "REDACTED_MONGODB_URI" in caplog.text
    assert "test-user" not in caplog.text
    assert "test-password" not in caplog.text


def test_lazy_mongo_initialization_is_single_and_index_failure_is_best_effort(
    monkeypatch, caplog
):
    settings = Settings(_env_file=None, MONGODB_URI="mongodb://test")
    database = object()

    class FakeClient:
        def __getitem__(self, _name):
            return database

    fake_client = FakeClient()
    counts = {"client": 0, "indexes": 0}
    count_lock = Lock()

    def fake_create_client(_settings):
        with count_lock:
            counts["client"] += 1
        sleep(0.02)
        return fake_client

    def fail_indexes(_db):
        with count_lock:
            counts["indexes"] += 1
        raise ServerSelectionTimeoutError("index server unavailable")

    monkeypatch.setattr("app.db.mongo.get_settings", lambda: settings)
    monkeypatch.setattr("app.db.mongo.create_client", fake_create_client)
    monkeypatch.setattr("app.db.mongo.ensure_indexes", fail_indexes)
    app = create_app()
    request = _request_for(app)

    with ThreadPoolExecutor(max_workers=10) as executor, caplog.at_level(
        "WARNING", logger="app.core.errors"
    ):
        databases = list(executor.map(lambda _index: get_database(request), range(20)))

    assert all(result is database for result in databases)
    assert counts == {"client": 1, "indexes": 1}
    assert "index server unavailable" in caplog.text


def test_empty_mongodb_uri_raises_database_unavailable(monkeypatch):
    settings = Settings(_env_file=None, MONGODB_URI="")
    monkeypatch.setattr("app.db.mongo.get_settings", lambda: settings)
    monkeypatch.setattr(
        "app.db.mongo.create_client",
        lambda _settings: pytest.fail("client must not be created without a URI"),
    )

    with pytest.raises(DatabaseUnavailableError):
        get_database(_request_for(create_app()))


def test_lifespan_closes_lazily_created_mongo_client(monkeypatch):
    settings = Settings(_env_file=None, MONGODB_URI="mongodb://test")
    database = SimpleNamespace(
        name="taskflow",
        client=SimpleNamespace(admin=SimpleNamespace(command=lambda _name: {"ok": 1})),
    )

    class FakeClient:
        closed = False

        def __getitem__(self, _name):
            return database

        def close(self):
            self.closed = True

    fake_client = FakeClient()
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    monkeypatch.setattr("app.db.mongo.get_settings", lambda: settings)
    monkeypatch.setattr("app.db.mongo.create_client", lambda _settings: fake_client)
    monkeypatch.setattr("app.db.mongo.ensure_indexes", lambda _db: [])
    app = create_app()

    with TestClient(app) as test_client:
        response = test_client.get("/health/db")
        assert response.status_code == 200

    assert fake_client.closed is True


def test_health_db_request_works_without_lifespan_with_dependency_override():
    database = SimpleNamespace(
        name="test-db",
        client=SimpleNamespace(admin=SimpleNamespace(command=lambda _name: {"ok": 1})),
    )
    app = create_app()
    app.dependency_overrides[get_database] = lambda: database
    test_client = TestClient(app)

    try:
        response = test_client.get("/health/db")
    finally:
        test_client.close()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "test-db"}


def test_health_db_returns_503_when_ping_fails_without_lifespan():
    def fail_ping(_command):
        raise ServerSelectionTimeoutError("MongoDB is unreachable")

    database = SimpleNamespace(
        name="test-db",
        client=SimpleNamespace(admin=SimpleNamespace(command=fail_ping)),
    )
    app = create_app()
    app.dependency_overrides[get_database] = lambda: database
    test_client = TestClient(app)

    try:
        response = test_client.get("/health/db")
    finally:
        test_client.close()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unreachable"}


def test_task_service_accepts_fake_store():
    class FakeStore:
        def __init__(self):
            self.document = None

        def create(self, document):
            self.document = document
            return {"id": "fake", **document}

    store = FakeStore()
    service = TaskService(store)

    result = service.create(TaskCreate(title="  Fake task  "))

    assert result["title"] == "Fake task"
    assert store.document["completed"] is False
    assert store.document["subtasks"] == []
