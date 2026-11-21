import json

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.ai.errors import (
    AIInvalidOutputError,
    AINotConfiguredError,
    AIProviderError,
    AIRateLimitedError,
    AITimeoutError,
)
from app.ai.providers.gemini import GeminiProvider
from app.api.v1.ai import get_ai_provider
from app.core.config import Settings
from app.core.rate_limit import SlidingWindowRateLimiter, enforce_ai_rate_limit
from app.db.mongo import get_database
from app.main import create_app
from tests.fakes import ScriptedFakeProvider

AI_URL = "/api/v1/ai"


@pytest.fixture
def ai_app(mock_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: mock_db
    return app


def install_provider(app, provider):
    app.dependency_overrides[get_ai_provider] = lambda: provider


@pytest.mark.parametrize(
    ("error_type", "expected_status", "expected_code", "attempts"),
    [
        (AINotConfiguredError, 503, "ai_not_configured", 1),
        (AITimeoutError, 504, "ai_timeout", 2),
        (AIRateLimitedError, 429, "ai_rate_limited", 1),
        (AIProviderError, 502, "ai_provider_error", 2),
        (AIInvalidOutputError, 502, "ai_invalid_output", 1),
    ],
)
def test_ai_error_handlers_return_safe_status_and_code(
    ai_app, error_type, expected_status, expected_code, attempts
):
    provider = ScriptedFakeProvider([error_type() for _ in range(attempts)])
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        response = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Write an outline"},
        )

    assert response.status_code == expected_status
    assert response.json()["code"] == expected_code
    assert len(provider.calls) == attempts
    assert "stack" not in response.text.lower()


def test_ai_endpoint_succeeds_with_overridden_provider(ai_app):
    provider = ScriptedFakeProvider(
        [
            json.dumps(
                {
                    "subtasks": [
                        {"title": "Plan", "description": None},
                        {"title": "Draft", "description": None},
                        {"title": "Review", "description": None},
                    ]
                }
            )
        ]
    )
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        response = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Create a report"},
        )

    assert response.status_code == 200
    assert len(response.json()["subtasks"]) == 3


def test_improve_endpoint_returns_null_due_date_without_date_reference(ai_app):
    provider = ScriptedFakeProvider(
        [
            json.dumps(
                {
                    "title": "Improved title",
                    "description": None,
                    "priority": "medium",
                    "due_date": "2026-11-20",
                }
            ),
            json.dumps(
                {
                    "title": "Improved title",
                    "description": "Organize the notes into a clear reference.",
                    "priority": "medium",
                    "due_date": "2026-11-20",
                }
            ),
        ]
    )
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        response = client.post(
            f"{AI_URL}/improve",
            json={"title": "Organize notes", "today": "2026-11-20"},
        )

    assert response.status_code == 200
    assert response.json()["due_date"] is None


def test_empty_gemini_key_maps_to_503_without_network(ai_app):
    install_provider(
        ai_app,
        GeminiProvider(Settings(_env_file=None, GEMINI_API_KEY="")),
    )

    with TestClient(ai_app) as client:
        response = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Create a report"},
        )

    assert response.status_code == 503
    assert response.json()["code"] == "ai_not_configured"


def test_ai_failure_does_not_affect_task_crud(ai_app):
    install_provider(ai_app, GeminiProvider(Settings(_env_file=None, GEMINI_API_KEY="")))

    with TestClient(ai_app) as client:
        ai_response = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Create a report"},
        )
        task_response = client.post(
            "/api/v1/tasks/",
            json={"title": "CRUD remains available"},
        )

    assert ai_response.status_code == 503
    assert task_response.status_code == 201
    assert task_response.json()["title"] == "CRUD remains available"


def test_ai_rate_limiter_rejects_after_configured_limit(ai_app):
    now = [1000.0]
    limiter = SlidingWindowRateLimiter(clock=lambda: now[0])

    def limit_one_request(request: Request):
        limiter.check("test-client", 1)

    ai_app.dependency_overrides[enforce_ai_rate_limit] = limit_one_request
    provider = ScriptedFakeProvider(
        [
            json.dumps(
                {
                    "subtasks": [
                        {"title": "Plan", "description": None},
                        {"title": "Draft", "description": None},
                        {"title": "Review", "description": None},
                    ]
                }
            )
        ]
    )
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        first = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Create a report"},
        )
        second = client.post(
            f"{AI_URL}/breakdown",
            json={"title": "Create another report"},
        )

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["code"] == "ai_rate_limited"
    assert len(provider.calls) == 1


def test_sliding_window_limiter_evicts_expired_key_and_isolates_keys():
    now = [1000.0]
    limiter = SlidingWindowRateLimiter(clock=lambda: now[0])

    limiter.check("client-a", 1)
    with pytest.raises(AIRateLimitedError):
        limiter.check("client-a", 1)

    limiter.check("client-b", 1)
    now[0] += 3601
    limiter.check("client-a", 1)


def test_empty_pending_plan_does_not_call_ai_provider(ai_app):
    provider = ScriptedFakeProvider([])
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        response = client.post(
            f"{AI_URL}/plan",
            json={"today": "2026-11-20", "available_minutes": 120},
        )

    assert response.status_code == 200
    assert response.json()["plan"] == []
    assert response.json()["postponed"] == []
    assert provider.calls == []


def test_plan_endpoint_reads_tasks_and_returns_database_fields(ai_app):
    plan_task = {
        "task_id": "placeholder",
        "title": "AI fabricated title",
        "priority": "low",
        "due_date": None,
        "minutes": 20,
        "reason": "Good next step.",
    }
    provider = ScriptedFakeProvider([])
    install_provider(ai_app, provider)

    with TestClient(ai_app) as client:
        created = client.post(
            "/api/v1/tasks/",
            json={
                "title": "Database-owned title",
                "priority": "high",
                "due_date": "2026-11-21",
                "estimated_duration": 20,
            },
        ).json()
        plan_task["task_id"] = created["id"]
        provider.responses.append(
            json.dumps(
                {
                    "summary": "Plan for today.",
                    "plan": [plan_task],
                    "postponed": [],
                    "warnings": [],
                    "total_minutes": 20,
                }
            )
        )
        response = client.post(
            f"{AI_URL}/plan",
            json={"today": "2026-11-20", "available_minutes": 60},
        )
        task_after_plan = client.get(
            f"/api/v1/tasks/{created['id']}"
        ).json()

    assert response.status_code == 200
    planned_task = response.json()["plan"][0]
    assert planned_task["title"] == "Database-owned title"
    assert planned_task["priority"] == "high"
    assert planned_task["due_date"] == "2026-11-21"
    assert task_after_plan["completed"] is False
    assert len(provider.calls) == 1
