from fastapi.testclient import TestClient

from app.core.config import Settings


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_load_without_env(monkeypatch):
    for key in [
        "APP_ENV",
        "CORS_ORIGINS",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_JWT_SECRET",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "AI_TIMEOUT_SECONDS",
        "AI_RATE_LIMIT_PER_HOUR",
    ]:
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)
    assert settings.APP_ENV == "development"
    assert settings.CORS_ORIGINS == ["http://localhost:3000"]
    assert settings.SUPABASE_URL is None
    assert settings.SUPABASE_ANON_KEY is None
    assert settings.SUPABASE_JWT_SECRET is None
    assert settings.GEMINI_API_KEY is None
    assert settings.GEMINI_MODEL == "gemini-2.5-flash"
    assert settings.AI_TIMEOUT_SECONDS == 20
    assert settings.AI_RATE_LIMIT_PER_HOUR == 30
