from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_test_user():
    email = f"task_user_{uuid4().hex[:8]}@taskflow.com"
    password = "TestPassword123!"

    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"

    return data["access_token"]


def auth_headers(token):
    return {
        "Authorization": f"Bearer {token}",
    }


def test_create_task():
    token = create_test_user()

    response = client.post(
        "/tasks",
        headers=auth_headers(token),
        json={
            "title": "Complete TaskFlow AI testing",
            "description": "Write automated tests for the task API.",
            "priority": "high",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["title"] == "Complete TaskFlow AI testing"
    assert data["description"] == (
        "Write automated tests for the task API."
    )
    assert data["priority"] == "high"
    assert "id" in data
    assert "status" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_get_tasks():
    token = create_test_user()

    create_response = client.post(
        "/tasks",
        headers=auth_headers(token),
        json={
            "title": "Test task list",
            "description": "Testing GET /tasks",
            "priority": "medium",
        },
    )

    assert create_response.status_code == 200

    response = client.get(
        "/tasks",
        headers=auth_headers(token),
    )

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(
        task["title"] == "Test task list"
        for task in data
    )


def test_get_single_task():
    token = create_test_user()

    create_response = client.post(
        "/tasks",
        headers=auth_headers(token),
        json={
            "title": "Test single task",
            "description": "Testing GET /tasks/{task_id}",
            "priority": "low",
        },
    )

    assert create_response.status_code == 200

    created_task = create_response.json()
    task_id = created_task["id"]

    response = client.get(
        f"/tasks/{task_id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == task_id
    assert data["title"] == "Test single task"


def test_update_task():
    token = create_test_user()

    create_response = client.post(
        "/tasks",
        headers=auth_headers(token),
        json={
            "title": "Original task title",
            "description": "Original description",
            "priority": "medium",
        },
    )

    assert create_response.status_code == 200

    task_id = create_response.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        headers=auth_headers(token),
        json={
            "title": "Updated task title",
            "description": "Updated description",
            "status": "completed",
            "priority": "high",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == task_id
    assert data["title"] == "Updated task title"
    assert data["description"] == "Updated description"
    assert data["status"] == "completed"
    assert data["priority"] == "high"


def test_delete_task():
    token = create_test_user()

    create_response = client.post(
        "/tasks",
        headers=auth_headers(token),
        json={
            "title": "Task to delete",
            "description": "This task should be deleted.",
            "priority": "low",
        },
    )

    assert create_response.status_code == 200

    task_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/tasks/{task_id}",
        headers=auth_headers(token),
    )

    assert delete_response.status_code == 200

    get_response = client.get(
        f"/tasks/{task_id}",
        headers=auth_headers(token),
    )

    assert get_response.status_code == 404


def test_tasks_require_authentication():
    response = client.get("/tasks")

    assert response.status_code == 401