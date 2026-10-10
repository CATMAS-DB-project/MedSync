from datetime import date, timedelta, time
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.domains.appointment.schemas import AppointmentReschedule, AppointmentStatus
from app.domains.auth.models import UserIdentity
from app.main import app


def test_appointment_reschedule_valid():
    future_date = date.today() + timedelta(days=2)
    payload = AppointmentReschedule(
        appointment_date=future_date,
        appointment_time=time(10, 30),
        reason="Patient requested reschedule",
    )
    assert payload.appointment_date == future_date
    assert payload.appointment_time == time(10, 30)
    assert payload.reason == "Patient requested reschedule"


def test_appointment_reschedule_normalizes_whitespace():
    future_date = date.today() + timedelta(days=1)
    payload = AppointmentReschedule(
        appointment_date=future_date,
        appointment_time=time(14, 0),
        reason="   Patient doctor requested change   ",
    )
    assert payload.reason == "Patient doctor requested change"


def test_appointment_reschedule_optional_reason():
    future_date = date.today() + timedelta(days=1)
    payload = AppointmentReschedule(
        appointment_date=future_date,
        appointment_time=time(14, 0),
    )
    assert payload.reason is None


def test_appointment_reschedule_rejects_past_date():
    past_date = date.today() - timedelta(days=1)
    with pytest.raises(ValidationError) as exc_info:
        AppointmentReschedule(
            appointment_date=past_date,
            appointment_time=time(9, 0),
            reason="Rescheduling into past",
        )
    assert "appointment_date cannot be in the past" in str(exc_info.value)


def test_openapi_routes_registered():
    paths = app.openapi()["paths"]
    assert "/api/v1/appointments/{appointment_id}" in paths
    assert "patch" in paths["/api/v1/appointments/{appointment_id}"]
    assert "/api/v1/appointments/{appointment_id}/reschedule-history" in paths
    assert "get" in paths["/api/v1/appointments/{appointment_id}/reschedule-history"]


@pytest.mark.asyncio
async def test_reschedule_service_not_found():
    from app.domains.appointment.service import reschedule_appointment
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = None

    result = await reschedule_appointment(
        mock_conn,
        appointment_id=999,
        body=AppointmentReschedule(
            appointment_date=date.today() + timedelta(days=1),
            appointment_time=time(10, 0),
        ),
        staff_id=2,
        branch_id=1,
    )
    assert result is None


@pytest.mark.asyncio
async def test_reschedule_service_rejects_completed_or_cancelled():
    from app.domains.appointment.service import reschedule_appointment
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = {
        "appointment_id": 10,
        "patient_id": 5,
        "doctor_staff_id": 3,
        "branch_id": 1,
        "status": "Completed",
        "is_walk_in": False,
        "consultation_notes": None,
    }

    with pytest.raises(ValueError) as exc:
        await reschedule_appointment(
            mock_conn,
            appointment_id=10,
            body=AppointmentReschedule(
                appointment_date=date.today() + timedelta(days=1),
                appointment_time=time(10, 0),
            ),
            staff_id=2,
            branch_id=1,
        )
    assert "Cannot reschedule appointment with status 'Completed'" in str(exc.value)


@pytest.mark.asyncio
async def test_reschedule_service_rejects_foreign_branch():
    from app.domains.appointment.service import reschedule_appointment
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = {
        "appointment_id": 10,
        "patient_id": 5,
        "doctor_staff_id": 3,
        "branch_id": 2,
        "status": "Scheduled",
        "is_walk_in": False,
        "consultation_notes": None,
    }
    mock_conn.fetchval.return_value = 2  # Doctor belongs to branch 2

    with pytest.raises(ValueError) as exc:
        await reschedule_appointment(
            mock_conn,
            appointment_id=10,
            body=AppointmentReschedule(
                appointment_date=date.today() + timedelta(days=1),
                appointment_time=time(10, 0),
            ),
            staff_id=2,
            branch_id=1,  # Receptionist belongs to branch 1
        )
    assert "Doctor must belong to the appointment branch" in str(exc.value)


@pytest.mark.asyncio
async def test_reschedule_service_success_transition_chain():
    from app.domains.appointment.service import reschedule_appointment
    mock_conn = AsyncMock()
    # 1. Fetch old appointment
    mock_conn.fetchrow.side_effect = [
        {
            "appointment_id": 10,
            "patient_id": 5,
            "doctor_staff_id": 3,
            "branch_id": 1,
            "status": "Scheduled",
            "is_walk_in": False,
            "consultation_notes": "Existing notes",
        },
        # 2. Insert new appointment RETURNING appointment_id
        {"appointment_id": 11},
        # 3. get_appointment query inside service
        {
            "appointment_id": 11,
            "patient_id": 5,
            "patient_name": "John Doe",
            "doctor_staff_id": 3,
            "doctor_name": "Dr. Smith",
            "branch_id": 1,
            "branch_name": "Colombo Central",
            "appointment_date": date.today() + timedelta(days=3),
            "appointment_time": time(11, 0),
            "status": "Scheduled",
            "cancel_reschedule_reason": "Rescheduled from visit #10: Patient requested morning slot",
        },
    ]
    mock_conn.fetchval.return_value = 1  # Doctor branch = 1

    new_app = await reschedule_appointment(
        mock_conn,
        appointment_id=10,
        body=AppointmentReschedule(
            appointment_date=date.today() + timedelta(days=3),
            appointment_time=time(11, 0),
            reason="Patient requested morning slot",
        ),
        staff_id=2,
        branch_id=1,
    )

    assert new_app["appointment_id"] == 11
    assert new_app["previous_appointment_id"] == 10
    assert new_app["status"] == "Scheduled"

    # Verify that UPDATE was called to set status to 'Re-Scheduled'
    update_calls = [c for c in mock_conn.execute.call_args_list if "Re-Scheduled" in str(c)]
    assert len(update_calls) == 1

