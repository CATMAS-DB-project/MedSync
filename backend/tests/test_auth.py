from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.domains.auth.models import UserIdentity
from app.domains.auth.router import get_credential_validator, get_refresh_store
from app.domains.auth.service import (
    DatabaseCredentialValidator,
    InMemoryCredentialValidator,
    InMemoryRefreshTokenStore,
)
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    credential_validator = InMemoryCredentialValidator(
        username="dev-admin",
        password_hash=PasswordHash.recommended().hash("password"),
        user=UserIdentity(staff_id=1, username="dev-admin", role="Admin", branch_id=1),
    )
    refresh_store = InMemoryRefreshTokenStore()
    app.dependency_overrides[get_credential_validator] = lambda: credential_validator
    app.dependency_overrides[get_refresh_store] = lambda: refresh_store
    yield TestClient(app)
    app.dependency_overrides.clear()

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


def test_get_me_returns_profile_with_linked_staff(client: TestClient) -> None:
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dev-admin", "password": "password"},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["staff_id"] == 1
    assert payload["username"] == "dev-admin"
    assert payload["role"] == "Admin"
    assert payload["branch_id"] == 1
    assert payload["first_name"] == "Dev"
    assert payload["last_name"] == "Admin"
    assert payload["job_title"] == "System Administrator"
    assert "email" in payload
    assert payload["branch_name"] == "Main Branch"
    assert payload["staff"]["staff_id"] == 1
    assert payload["staff"]["first_name"] == "Dev"
    assert payload["staff"]["branch_name"] == "Main Branch"


@pytest.mark.asyncio
async def test_database_credential_validator_updates_last_login_on_success() -> None:
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    # Mock pool.acquire context manager
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    # Mock connection.transaction context manager
    mock_tx = AsyncMock()
    mock_tx.__aenter__.return_value = mock_conn
    mock_tx.__aexit__.return_value = None
    mock_conn.transaction = MagicMock(return_value=mock_tx)

    hashed = PasswordHash.recommended().hash("secret123")
    mock_conn.fetchrow.return_value = {
        "staff_id": 10,
        "username": "dr_john",
        "password_hash": hashed,
        "role": "Doctor",
        "branch_id": 2,
        "first_name": "John",
        "last_name": "Smith",
        "job_title": "General Physician",
        "branch_name": "Colombo Branch",
    }

    validator = DatabaseCredentialValidator(mock_pool)
    user = await validator.authenticate("dr_john", "secret123")

    assert user is not None
    assert user.staff_id == 10
    assert user.first_name == "John"
    assert user.last_name == "Smith"
    assert user.job_title == "General Physician"
    assert user.branch_name == "Colombo Branch"
    assert user.staff is not None
    assert user.staff.first_name == "John"

    # Verify UPDATE user_account SET last_login = NOW() was executed
    mock_conn.execute.assert_awaited_once()
    execute_args = mock_conn.execute.call_args[0]
    assert "UPDATE user_account" in execute_args[0]
    assert "last_login = NOW()" in execute_args[0]
    assert execute_args[1] == 10


@pytest.mark.asyncio
async def test_database_credential_validator_does_not_update_on_invalid_password() -> None:
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    mock_tx = AsyncMock()
    mock_tx.__aenter__.return_value = mock_conn
    mock_tx.__aexit__.return_value = None
    mock_conn.transaction = MagicMock(return_value=mock_tx)

    hashed = PasswordHash.recommended().hash("secret123")
    mock_conn.fetchrow.return_value = {
        "staff_id": 10,
        "username": "dr_john",
        "password_hash": hashed,
        "role": "Doctor",
        "branch_id": 2,
        "first_name": "John",
        "last_name": "Smith",
        "job_title": "General Physician",
        "branch_name": "Colombo Branch",
    }

    validator = DatabaseCredentialValidator(mock_pool)
    user = await validator.authenticate("dr_john", "wrong_password")

    assert user is None
    mock_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_database_credential_validator_get_user_profile() -> None:
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    mock_conn.fetchrow.return_value = {
        "staff_id": 5,
        "username": "sarah_rec",
        "role": "Receptionist",
        "branch_id": 1,
        "first_name": "Sarah",
        "last_name": "Connor",
        "job_title": "Senior Receptionist",
        "branch_name": "Kandy Branch",
    }

    validator = DatabaseCredentialValidator(mock_pool)
    profile = await validator.get_user_profile(5)

    assert profile is not None
    assert profile.staff_id == 5
    assert profile.username == "sarah_rec"
    assert profile.role == "Receptionist"
    assert profile.branch_id == 1
    assert profile.first_name == "Sarah"
    assert profile.last_name == "Connor"
    assert profile.job_title == "Senior Receptionist"
    assert profile.branch_name == "Kandy Branch"
    assert profile.staff is not None
    assert profile.staff.staff_id == 5
    assert profile.staff.branch_name == "Kandy Branch"