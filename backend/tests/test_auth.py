import os

os.environ["DATABASE_URL"] = "sqlite:///./test_taskflow.db"

import pytest
from fastapi.testclient import TestClient

from app.db.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


client = TestClient(app)


def test_register_user():
    response = client.post(
        "/auth/register",
        json={
            "email": "pytest_user@taskflow.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_user():
    register_response = client.post(
        "/auth/register",
        json={
            "email": "login_user@taskflow.com",
            "password": "TestPassword123!",
        },
    )

    assert register_response.status_code == 200

    login_response = client.post(
        "/auth/login",
        json={
            "email": "login_user@taskflow.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    data = login_response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_get_current_user():
    register_response = client.post(
        "/auth/register",
        json={
            "email": "me_user@taskflow.com",
            "password": "TestPassword123!",
        },
    )

    assert register_response.status_code == 200

    register_data = register_response.json()
    token = register_data["access_token"]

    me_response = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert me_response.status_code == 200

    data = me_response.json()

    assert data["email"] == "me_user@taskflow.com"
    assert "id" in data