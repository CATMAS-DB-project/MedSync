from datetime import date
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.domains.appointment import router as appointment_router
from app.domains.auth.models import UserIdentity
from app.domains.billing import router as billing_router
from app.domains.patients import router as patients_router
from app.domains.staff import router as staff_router
from app.domains.staff.schemas import StaffCreate

BM = UserIdentity(
    staff_id=10,
    username="bm",
    role="Branch Manager",
    branch_id=1,
)
ADMIN = UserIdentity(
    staff_id=1,
    username="admin",
    role="Admin",
)
PAGE = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}


@pytest.mark.asyncio
async def test_staff_list_rejects_another_branch() -> None:
    conn = AsyncMock()

    with pytest.raises(HTTPException, match="only list staff"):
        await staff_router.list_staff(conn, BM, PAGE, branch_id=2)


@pytest.mark.asyncio
async def test_staff_list_forces_manager_branch(monkeypatch) -> None:
    conn = AsyncMock()
    list_staff = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(staff_router.service, "list_staff", list_staff)

    await staff_router.list_staff(conn, BM, PAGE, None, None, None, None)

    assert list_staff.await_args is not None
    assert list_staff.await_args.args[3] == 1


@pytest.mark.asyncio
async def test_admin_staff_list_remains_unrestricted(monkeypatch) -> None:
    conn = AsyncMock()
    list_staff = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(staff_router.service, "list_staff", list_staff)

    await staff_router.list_staff(conn, ADMIN, PAGE, None, None, None, None)

    assert list_staff.await_args is not None
    assert list_staff.await_args.args[3] is None


@pytest.mark.asyncio
async def test_staff_create_rejects_another_branch() -> None:
    conn = AsyncMock()
    body = StaffCreate(
        nic="123456789V",
        first_name="Test",
        last_name="Staff",
        date_of_birth=date(1990, 1, 1),
        gender="Male",
        address=None,
        branch_id=2,
        job_title="Nurse",
        hire_date=date(2024, 1, 1),
    )

    with pytest.raises(HTTPException, match="must belong to your branch"):
        await staff_router.create_staff(body, conn, BM)


@pytest.mark.asyncio
async def test_staff_detail_rejects_another_branch() -> None:
    conn = AsyncMock()
    conn.fetchval.return_value = 2

    with pytest.raises(HTTPException, match="outside your branch"):
        await staff_router.get_staff(20, conn, BM)


@pytest.mark.asyncio
async def test_doctor_list_rejects_another_branch() -> None:
    conn = AsyncMock()

    with pytest.raises(HTTPException, match="only list doctors"):
        await staff_router.list_doctors(conn, BM, branch_id=2)


@pytest.mark.asyncio
async def test_patient_list_rejects_another_branch() -> None:
    conn = AsyncMock()
    paging = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}

    with pytest.raises(HTTPException, match="only list patients"):
        await patients_router.list_patients(
            conn,
            BM,
            paging,
            branch_id=2,
        )


@pytest.mark.asyncio
async def test_patient_detail_rejects_another_branch() -> None:
    conn = AsyncMock()
    conn.fetchval.return_value = 2

    with pytest.raises(HTTPException, match="outside your branch"):
        await patients_router.get_patient(20, conn, BM)


@pytest.mark.asyncio
async def test_appointment_list_rejects_another_branch() -> None:
    conn = AsyncMock()
    paging = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}

    with pytest.raises(HTTPException, match="only list appointments"):
        await appointment_router.list_appointments(
            conn,
            BM,
            paging,
            branch_id=2,
        )


@pytest.mark.asyncio
async def test_appointment_detail_is_scoped_to_manager_branch(monkeypatch) -> None:
    conn = AsyncMock()
    get_appointment = AsyncMock(return_value=None)
    monkeypatch.setattr(appointment_router.service, "get_appointment", get_appointment)

    with pytest.raises(HTTPException, match="Appointment not found"):
        await appointment_router.get_appointment(20, conn, BM)

    assert get_appointment.await_args is not None
    assert get_appointment.await_args.args == (conn, 20, 1)


@pytest.mark.asyncio
async def test_invoice_list_rejects_another_branch() -> None:
    conn = AsyncMock()
    paging = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}

    with pytest.raises(HTTPException, match="only list invoices"):
        await billing_router.list_invoices(
            conn,
            BM,
            paging,
            branch_id=2,
        )


@pytest.mark.asyncio
async def test_claim_list_rejects_another_branch() -> None:
    conn = AsyncMock()
    paging = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}

    with pytest.raises(HTTPException, match="only list claims"):
        await billing_router.list_claims(
            conn,
            BM,
            paging,
            branch_id=2,
        )
