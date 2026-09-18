import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)

#Dev Logins
'''
username: dev-admin
password: password
'''

def login(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "dev-admin", "password": "password"},
    )
    assert response.status_code == 200
    refresh_token = client.cookies.get("catms_refresh_token")
    assert refresh_token
    return refresh_token


def test_login_rejects_invalid_credentials(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "dev-admin", "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_protected_profile_requires_access_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_refresh_rotates_and_rejects_reuse(client: TestClient) -> None:
    original_refresh_token = login(client)

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    replacement_refresh_token = client.cookies.get("catms_refresh_token")
    assert replacement_refresh_token
    assert replacement_refresh_token != original_refresh_token

    client.cookies.set("catms_refresh_token", original_refresh_token)
    reuse_response = client.post("/api/v1/auth/refresh")

    assert reuse_response.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    login(client)

    logout_response = client.post("/api/v1/auth/logout")
    refresh_response = client.post("/api/v1/auth/refresh")

    assert logout_response.status_code == 204
    assert refresh_response.status_code == 401