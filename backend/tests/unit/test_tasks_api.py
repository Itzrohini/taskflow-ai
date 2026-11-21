import time

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

TASKS_URL = "/api/v1/tasks/"
TODAY = "2026-11-20"


def create_task(client: TestClient, **payload):
    response = client.post(TASKS_URL, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_task_defaults_and_normalizes_fields(task_client: TestClient):
    task = create_task(
        task_client,
        title="  Write tests  ",
        description="",
        due_date=TODAY,
        estimated_duration=30,
    )

    assert task["title"] == "Write tests"
    assert task["description"] is None
    assert task["priority"] == "medium"
    assert task["completed"] is False
    assert task["due_date"] == TODAY
    assert task["estimated_duration"] == 30
    assert task["subtasks"] == []
    assert task["completed_at"] is None
    assert task["created_at"].endswith("Z")
    assert task["updated_at"].endswith("Z")


@pytest.mark.parametrize(
    "payload",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "Valid", "priority": "urgent"},
        {"title": "Valid", "due_date": "not-a-date"},
        {"title": "Valid", "unknown": True},
    ],
)
def test_create_rejects_invalid_fields(task_client: TestClient, payload):
    response = task_client.post(TASKS_URL, json=payload)
    assert response.status_code == 422


def test_create_task_with_embedded_subtasks(task_client: TestClient):
    task = create_task(
        task_client,
        title="Parent",
        subtasks=[
            {"title": "First", "description": "one"},
            {"title": "Second"},
        ],
    )

    assert [subtask["title"] for subtask in task["subtasks"]] == ["First", "Second"]
    assert len({subtask["id"] for subtask in task["subtasks"]}) == 2
    assert all(len(subtask["id"]) == 32 for subtask in task["subtasks"])
    assert all(subtask["completed"] is False for subtask in task["subtasks"])
    assert all(subtask["created_at"].endswith("Z") for subtask in task["subtasks"])


def test_get_task_and_not_found_ids(task_client: TestClient):
    task = create_task(task_client, title="Find me")

    response = task_client.get(f"{TASKS_URL}{task['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == task["id"]

    for task_id in ("not-an-object-id", "000000000000000000000000"):
        response = task_client.get(f"{TASKS_URL}{task_id}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Task not found"}


def test_partial_update_can_clear_values_and_refresh_updated_at(
    task_client: TestClient,
):
    task = create_task(
        task_client,
        title="Editable",
        description="Keep some fields",
        priority="low",
        due_date=TODAY,
        estimated_duration=20,
    )
    time.sleep(0.002)

    response = task_client.patch(
        f"{TASKS_URL}{task['id']}",
        json={"description": None, "due_date": None, "estimated_duration": None},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Editable"
    assert updated["priority"] == "low"
    assert updated["description"] is None
    assert updated["due_date"] is None
    assert updated["estimated_duration"] is None
    assert updated["updated_at"] != task["updated_at"]
    assert updated["updated_at"].endswith("Z")


def test_completing_and_reopening_sets_and_clears_completed_at(
    task_client: TestClient,
):
    task = create_task(task_client, title="Complete me")

    completed = task_client.patch(
        f"{TASKS_URL}{task['id']}", json={"completed": True}
    ).json()
    assert completed["completed"] is True
    assert completed["completed_at"].endswith("Z")

    reopened = task_client.patch(
        f"{TASKS_URL}{task['id']}", json={"completed": False}
    ).json()
    assert reopened["completed"] is False
    assert reopened["completed_at"] is None


def test_delete_then_get_returns_404(task_client: TestClient):
    task = create_task(task_client, title="Delete me")
    response = task_client.delete(f"{TASKS_URL}{task['id']}")
    assert response.status_code == 204
    assert response.content == b""
    assert task_client.get(f"{TASKS_URL}{task['id']}").status_code == 404


def test_subtask_add_single_and_bulk_edit_toggle_delete_and_not_found(
    task_client: TestClient,
):
    task = create_task(task_client, title="Parent")
    response = task_client.post(
        f"{TASKS_URL}{task['id']}/subtasks",
        json={"subtasks": [{"title": "Single"}]},
    )
    assert response.status_code == 201
    task = response.json()
    first_id = task["subtasks"][0]["id"]

    response = task_client.post(
        f"{TASKS_URL}{task['id']}/subtasks",
        json={"subtasks": [{"title": "Bulk one"}, {"title": "Bulk two"}]},
    )
    assert response.status_code == 201
    task = response.json()
    assert [item["title"] for item in task["subtasks"]] == [
        "Single",
        "Bulk one",
        "Bulk two",
    ]

    response = task_client.patch(
        f"{TASKS_URL}{task['id']}/subtasks/{first_id}",
        json={"title": "Edited", "description": None, "completed": True},
    )
    assert response.status_code == 200
    task = response.json()
    assert task["subtasks"][0]["title"] == "Edited"
    assert task["subtasks"][0]["completed"] is True

    response = task_client.patch(
        f"{TASKS_URL}{task['id']}/subtasks/{first_id}",
        json={"completed": False},
    )
    assert response.status_code == 200
    assert response.json()["subtasks"][0]["completed"] is False

    response = task_client.delete(
        f"{TASKS_URL}{task['id']}/subtasks/{first_id}"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["subtasks"]] == [
        "Bulk one",
        "Bulk two",
    ]

    missing = task_client.patch(
        f"{TASKS_URL}{task['id']}/subtasks/missing",
        json={"completed": True},
    )
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Subtask not found"}


def test_subtask_endpoint_returns_404_for_missing_task(task_client: TestClient):
    response = task_client.post(
        f"{TASKS_URL}000000000000000000000000/subtasks",
        json={"subtasks": [{"title": "Orphan"}]},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_list_status_priority_and_due_filters(task_client: TestClient):
    overdue = create_task(
        task_client, title="Overdue", priority="low", due_date="2026-11-19"
    )
    due_today = create_task(
        task_client, title="Today", priority="high", due_date=TODAY
    )
    upcoming = create_task(
        task_client, title="Upcoming", priority="medium", due_date="2026-11-21"
    )
    no_due = create_task(task_client, title="No due date", priority="low")
    completed = create_task(
        task_client,
        title="Completed overdue",
        priority="medium",
        due_date="2026-11-19",
    )
    task_client.patch(f"{TASKS_URL}{completed['id']}", json={"completed": True})

    def ids(**params):
        response = task_client.get(TASKS_URL, params={"today": TODAY, **params})
        assert response.status_code == 200
        return {item["id"] for item in response.json()["items"]}

    assert ids(status="pending") == {
        overdue["id"],
        due_today["id"],
        upcoming["id"],
        no_due["id"],
    }
    assert ids(status="completed") == {completed["id"]}
    assert ids(priority="low") == {overdue["id"], no_due["id"]}
    assert ids(due="overdue") == {overdue["id"]}
    assert ids(due="today") == {due_today["id"]}
    assert ids(due="upcoming") == {upcoming["id"]}
    assert ids(due="none") == {no_due["id"]}


def test_list_search_treats_regex_characters_literally(task_client: TestClient):
    literal = create_task(task_client, title="Find a.b( literally")
    description_match = create_task(
        task_client, title="Find in description", description="a.b( appears here"
    )
    create_task(task_client, title="Find axb( instead")

    response = task_client.get(TASKS_URL, params={"q": "a.b("})
    assert response.status_code == 200
    assert {item["id"] for item in response.json()["items"]} == {
        literal["id"],
        description_match["id"],
    }


def test_list_due_sort_puts_missing_dates_last_and_paginates(
    task_client: TestClient,
):
    no_due = create_task(task_client, title="No date")
    late = create_task(task_client, title="Late", due_date="2026-11-22")
    early = create_task(task_client, title="Early", due_date="2026-11-21")

    first_page = task_client.get(
        TASKS_URL,
        params={"sort": "due_asc", "today": TODAY, "limit": 2, "skip": 0},
    ).json()
    second_page = task_client.get(
        TASKS_URL,
        params={"sort": "due_asc", "today": TODAY, "limit": 2, "skip": 2},
    ).json()
    assert [item["id"] for item in first_page["items"]] == [early["id"], late["id"]]
    assert [item["id"] for item in second_page["items"]] == [no_due["id"]]
    assert first_page["total"] == 3


def test_stats_counts_and_static_route(task_client: TestClient):
    overdue = create_task(
        task_client, title="Overdue", priority="low", due_date="2026-11-19"
    )
    create_task(task_client, title="Today low", priority="low", due_date=TODAY)
    create_task(
        task_client, title="Upcoming medium", priority="medium", due_date="2026-11-21"
    )
    completed = create_task(
        task_client, title="Today completed", priority="high", due_date=TODAY
    )
    task_client.patch(f"{TASKS_URL}{completed['id']}", json={"completed": True})

    response = task_client.get(f"{TASKS_URL}stats", params={"today": TODAY})
    assert response.status_code == 200
    assert response.json() == {
        "total": 4,
        "completed": 1,
        "pending": 3,
        "overdue": 1,
        "due_today": 2,
        "completion_rate": 25.0,
        "pending_by_priority": {"low": 2, "medium": 1, "high": 0},
    }
    assert task_client.get(f"{TASKS_URL}{overdue['id']}").status_code == 200


def test_stats_returns_zeroes_for_empty_database(task_client: TestClient):
    response = task_client.get(f"{TASKS_URL}stats", params={"today": TODAY})
    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "completed": 0,
        "pending": 0,
        "overdue": 0,
        "due_today": 0,
        "completion_rate": 0.0,
        "pending_by_priority": {"low": 0, "medium": 0, "high": 0},
    }


def test_task_routes_return_503_when_database_unavailable(client: TestClient):
    response = client.get(TASKS_URL)
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}


def test_task_route_maps_pymongo_connection_failure_to_503(
    task_client: TestClient,
    mock_db,
):
    def fail_connection(*args, **kwargs):
        raise ServerSelectionTimeoutError("SSL handshake failed")

    mock_db.tasks.count_documents = fail_connection

    response = task_client.get(TASKS_URL)

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}

