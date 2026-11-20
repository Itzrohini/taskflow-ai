import mongomock
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.mongo import get_database
from app.main import create_app


@pytest.fixture(autouse=True)
def isolate_unit_tests_from_mongodb(request, monkeypatch):
    if request.node.get_closest_marker("integration"):
        yield
        return

    monkeypatch.setenv("MONGODB_URI", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def app_instance():
    return create_app()


@pytest.fixture
def client(app_instance):
    with TestClient(app_instance) as test_client:
        yield test_client


@pytest.fixture
def mock_db():
    mock_client = mongomock.MongoClient()
    return mock_client.taskflow


@pytest.fixture
def task_client(mock_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: mock_db
    with TestClient(app) as test_client:
        yield test_client
