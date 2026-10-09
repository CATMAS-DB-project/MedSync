import pytest
from fastapi import HTTPException

from app.domains.auth.models import UserIdentity
from app.domains.report.router import _effective_branch_id
from app.domains.report.service import outstanding_balances, treatment_frequency


class FetchConnection:
    def __init__(self) -> None:
        self.query = ""
        self.values: tuple[object, ...] = ()

    async def fetch(self, query: str, *values: object) -> list[dict]:
        self.query = query
        self.values = values
        return []


def identity(role: str, branch_id: int | None = None) -> UserIdentity:
    return UserIdentity(
        staff_id=1,
        username="test-user",
        role=role,
        branch_id=branch_id,
    )


def test_admin_can_request_any_branch() -> None:
    assert _effective_branch_id(identity("Admin", 1), 2) == 2
    assert _effective_branch_id(identity("Admin", 1), None) is None


def test_branch_manager_defaults_to_assigned_branch() -> None:
    user = identity("Branch Manager", 7)

    assert _effective_branch_id(user, None) == 7
    assert _effective_branch_id(user, 7) == 7


def test_branch_manager_cannot_request_another_branch() -> None:
    with pytest.raises(HTTPException) as error:
        _effective_branch_id(identity("Branch Manager", 7), 8)

    assert error.value.status_code == 403


def test_unassigned_branch_manager_is_forbidden() -> None:
    with pytest.raises(HTTPException) as error:
        _effective_branch_id(identity("Branch Manager"), None)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_outstanding_balances_always_order_filtered_results() -> None:
    conn = FetchConnection()

    await outstanding_balances(conn, branch_id=7)

    assert "WHERE o.outstanding_amount > 0 AND a.branch_id = $1" in conn.query
    assert "ORDER BY o.outstanding_amount DESC, patient_name" in conn.query
    assert conn.values == (7,)


@pytest.mark.asyncio
async def test_outstanding_balances_applies_patient_scope() -> None:
    conn = FetchConnection()

    await outstanding_balances(conn, branch_id=None, patient_id=42)

    assert "WHERE o.outstanding_amount > 0 AND a.patient_id = $1" in conn.query
    assert conn.values == (42,)


@pytest.mark.asyncio
async def test_treatment_frequency_applies_branch_scope() -> None:
    conn = FetchConnection()

    await treatment_frequency(
        conn,
        branch_id=7,
        category=None,
        from_date=None,
        to_date=None,
    )

    assert "a.branch_id = $1" in conn.query
    assert conn.values == (7,)
