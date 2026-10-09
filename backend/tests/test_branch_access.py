from datetime import date
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.domains.appointment import service as appointment_service
from app.domains.appointment.schemas import AppointmentCreate
from app.domains.auth.models import UserIdentity
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
async def test_patient_list_preserves_cross_branch_filter(monkeypatch) -> None:
    conn = AsyncMock()
    paging = {"offset": 0, "limit": 25, "page": 1, "page_size": 25}
    list_patients = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(patients_router.service, "list_patients", list_patients)
    await patients_router.list_patients(conn, BM, paging, branch_id=2)
    assert list_patients.await_args.args[2] == 2


@pytest.mark.asyncio
async def test_doctor_list_preserves_cross_branch_filter(monkeypatch) -> None:
    conn = AsyncMock()
    list_doctors = AsyncMock(return_value=[])
    monkeypatch.setattr(staff_router.service, "list_doctors", list_doctors)
    await staff_router.list_doctors(conn, BM, branch_id=2)
    assert list_doctors.await_args.args[1] == 2


@pytest.mark.asyncio
async def test_receptionist_cannot_write_patient_from_another_branch() -> None:
    conn = AsyncMock()
    conn.fetchval.return_value = 2

    with pytest.raises(HTTPException, match="outside your branch"):
        await patients_router._require_patient_write(conn, 42, BM)


@pytest.mark.asyncio
async def test_emergency_appointment_allows_patient_registered_elsewhere() -> None:
    conn = AsyncMock()
    conn.fetchval.side_effect = [1, 2]
    conn.fetchrow.side_effect = [
        {"appointment_id": 99},
        {"appointment_id": 99, "branch_id": 1, "patient_id": 7},
    ]
    body = AppointmentCreate(
        patient_id=7,
        doctor_staff_id=10,
        branch_id=1,
        appointment_date=date(2026, 1, 1),
        appointment_time="09:00",
        is_walk_in=True,
    )

    result = await appointment_service.create_appointment(
        conn, body, booked_by_staff_id=20, branch_id=1
    )

    assert result["appointment_id"] == 99
