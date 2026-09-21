from uuid import uuid4

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app

client = TestClient(app)


def create_test_user():
    email = f"ai_user_{uuid4().hex[:8]}@taskflow.com"
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


def test_ai_create_task(monkeypatch):
    token = create_test_user()

    def mock_generate_task_from_text(text):
        return {
            "title": "Complete project report",
            "description": "Finish and submit the project report.",
            "priority": "high",
        }

    monkeypatch.setattr(
        main_module,
        "generate_task_from_text",
        mock_generate_task_from_text,
    )

    response = client.post(
        "/ai/create-task",
        headers=auth_headers(token),
        json={
            "text": (
                "Finish my project report by Friday "
                "and make it high priority."
            ),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == "Task generated successfully"
    assert "task" in data

    task = data["task"]

    assert task["title"] == "Complete project report"
    assert task["description"] == (
        "Finish and submit the project report."
    )
    assert task["priority"] == "high"


def test_ai_breakdown_task(monkeypatch):
    token = create_test_user()

    def mock_breakdown_task(text):
        return [
            "Define the project requirements",
            "Implement the main features",
            "Test the application",
            "Prepare the final report",
        ]

    monkeypatch.setattr(
        main_module,
        "breakdown_task",
        mock_breakdown_task,
    )

    response = client.post(
        "/ai/breakdown-task",
        headers=auth_headers(token),
        json={
            "text": "Complete my TaskFlow AI project.",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Task breakdown generated successfully"
    )
    assert "breakdown" in data

    breakdown = data["breakdown"]

    assert isinstance(breakdown, list)
    assert len(breakdown) == 4
    assert breakdown[0] == "Define the project requirements"


def test_ai_suggest_priority(monkeypatch):
    token = create_test_user()

    def mock_suggest_task_priority(title, description):
        return {
            "priority": "high",
            "reason": (
                "The task has a near deadline "
                "and significant consequences."
            ),
            "analysis": {
                "urgency": 8,
                "importance": 9,
                "deadline": 9,
                "consequences": 8,
                "blocking_impact": 2,
            },
        }

    monkeypatch.setattr(
        main_module,
        "suggest_task_priority",
        mock_suggest_task_priority,
    )

    response = client.post(
        "/ai/suggest-priority",
        headers=auth_headers(token),
        json={
            "title": "Submit final project",
            "description": (
                "The project must be submitted "
                "before the deadline."
            ),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Priority suggestion generated successfully"
    )
    assert "suggestion" in data

    suggestion = data["suggestion"]

    assert suggestion["priority"] == "high"
    assert "reason" in suggestion
    assert "analysis" in suggestion

    analysis = suggestion["analysis"]

    assert analysis["urgency"] == 8
    assert analysis["importance"] == 9
    assert analysis["deadline"] == 9


def test_ai_productivity_insights(monkeypatch):
    token = create_test_user()

    def mock_generate_productivity_insights(tasks):
        return {
            "summary": (
                "You have completed several tasks "
                "and still have some high-priority work."
            ),
            "insights": [
                "Focus on high-priority tasks first.",
                "Maintain a consistent completion rate.",
            ],
        }

    monkeypatch.setattr(
        main_module,
        "generate_productivity_insights",
        mock_generate_productivity_insights,
    )

    response = client.post(
        "/ai/productivity-insights",
        headers=auth_headers(token),
        json={
            "tasks": [
                {
                    "title": "Finish backend",
                    "status": "completed",
                    "priority": "high",
                },
                {
                    "title": "Build frontend",
                    "status": "pending",
                    "priority": "medium",
                },
                {
                    "title": "Write documentation",
                    "status": "pending",
                    "priority": "high",
                },
            ],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Productivity insights generated successfully"
    )
    assert "insights" in data

    insights = data["insights"]

    assert isinstance(insights, dict)
    assert "summary" in insights
    assert "insights" in insights

    assert isinstance(insights["summary"], str)
    assert isinstance(insights["insights"], list)


def test_ai_create_task_requires_authentication():
    response = client.post(
        "/ai/create-task",
        json={
            "text": "Create a task for my project.",
        },
    )

    assert response.status_code == 401


def test_ai_breakdown_requires_authentication():
    response = client.post(
        "/ai/breakdown-task",
        json={
            "text": "Break this project into smaller tasks.",
        },
    )

    assert response.status_code == 401


def test_ai_priority_requires_authentication():
    response = client.post(
        "/ai/suggest-priority",
        json={
            "title": "Finish project",
            "description": "Finish the project this week.",
        },
    )

    assert response.status_code == 401


def test_ai_productivity_insights_requires_authentication():
    response = client.post(
        "/ai/productivity-insights",
        json={
            "tasks": [],
        },
    )

    assert response.status_code == 401