from fastapi.testclient import TestClient

from app.db.mongo import get_database
from app.main import create_app


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_returns_503_when_no_database_configured(client: TestClient):
    response = client.get("/health/db")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}


def test_health_db_returns_200_when_get_database_overridden(mock_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: mock_db
    with TestClient(app) as test_client:
        response = test_client.get("/health/db")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "taskflow"}


def test_health_db_returns_503_when_ping_fails(mock_db, monkeypatch):
    def failing_ping(*args, **kwargs):
        raise ConnectionError("Server unavailable")

    monkeypatch.setattr(mock_db.client.admin, "command", failing_ping)

    app = create_app()
    app.dependency_overrides[get_database] = lambda: mock_db
    with TestClient(app) as test_client:
        response = test_client.get("/health/db")
        assert response.status_code == 503
        assert response.json() == {"detail": "Database is unreachable"}
