from datetime import date
from typing import Annotated, Literal

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.db import get_conn, with_transaction
from app.core.deps import require_role
from app.core.pagination import list_response, pagination
from app.domains.appointment import service
from app.domains.appointment.schemas import AppointmentCancel, AppointmentCreate
from app.domains.auth.models import UserIdentity

router = APIRouter(tags=["appointments"])
settings = get_settings()


@router.get("/appointments")
async def list_appointments(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[
        UserIdentity,
        Depends(require_role("Receptionist", "Doctor", "Admin", "Branch Manager")),
    ],
    page_options: Annotated[dict[str, int], Depends(pagination)],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    doctor_id: Annotated[int | None, Query(gt=0)] = None,
    appointment_date: Annotated[date | None, Query(alias="date")] = None,
    appointment_status: Annotated[
        Literal["Scheduled", "Completed", "Cancelled"] | None,
        Query(alias="status"),
    ] = None,
    patient_id: Annotated[int | None, Query(gt=0)] = None,
) -> dict:
    items, total = await service.list_appointments(
        conn,
        branch_id=branch_id,
        doctor_id=doctor_id,
        appointment_date=appointment_date,
        status=appointment_status,
        patient_id=patient_id,
        limit=page_options["limit"],
        offset=page_options["offset"],
    )
    data = list_response(
        items, total, page_options["page"], page_options["page_size"]
    )
    return {"data": data, "error": None}


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: AppointmentCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    data = await service.create_appointment(conn, body, user.staff_id)
    return {"data": data, "error": None}


@router.get("/appointments/availability")
async def get_availability(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
    doctor_id: Annotated[int, Query(gt=0)],
    appointment_date: Annotated[date, Query(alias="date")],
) -> dict:
    data = await service.list_availability(
        conn,
        doctor_id=doctor_id,
        appointment_date=appointment_date,
        opening_time=settings.clinic_opening_time,
        closing_time=settings.clinic_closing_time,
        slot_minutes=settings.clinic_slot_minutes,
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found"
        )
    return {"data": data, "error": None}


@router.get("/appointments/{appointment_id}")
async def get_appointment(
    appointment_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[
        UserIdentity,
        Depends(require_role("Receptionist", "Doctor", "Admin", "Branch Manager")),
    ],
) -> dict:
    data = await service.get_appointment(conn, appointment_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found"
        )
    return {"data": data, "error": None}


@router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: int,
    body: AppointmentCancel,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    data = await service.cancel_appointment(conn, appointment_id, body.reason)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled appointment not found",
        )
    return {"data": data, "error": None}


@router.post("/appointments/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: int,
    _user: Annotated[UserIdentity, Depends(require_role("Doctor"))],
) -> dict:
    async with with_transaction(staff_id=_user.staff_id) as conn:
        data = await service.complete_appointment(conn, appointment_id)
        if data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scheduled appointment not found",
            )
    return {"data": data, "error": None}