from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_conn, with_transaction
from app.core.deps import require_role
from app.domains.appointment_treatment import service
from app.domains.appointment_treatment.schemas import (
    ConsultationNotesUpdate,
    TreatmentAmendCreate,
    TreatmentLogCreate,
)
from app.domains.auth.models import UserIdentity

router = APIRouter(tags=["appointment-treatments"])


@router.get("/appointments/{appointment_id}/treatments")
async def list_appointment_treatments(
    appointment_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[
        UserIdentity, Depends(require_role("Doctor", "Receptionist"))
    ],
) -> dict:
    data = await service.list_treatments(
        conn, appointment_id, user.staff_id if user.role == "Doctor" else None
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"data": data, "error": None}


@router.post(
    "/appointments/{appointment_id}/treatments",
    status_code=status.HTTP_201_CREATED,
)
async def create_appointment_treatment(
    appointment_id: int,
    body: TreatmentLogCreate,
    user: Annotated[UserIdentity, Depends(require_role("Doctor"))],
) -> dict:
    async with with_transaction(staff_id=user.staff_id) as conn:
        data = await service.create_treatment(
            conn, appointment_id, body, doctor_id=user.staff_id
        )
        if data is None:
            raise HTTPException(
                status_code=404,
                detail="Appointment or treatment catalogue item not found",
            )
    return {"data": data, "error": None}


@router.post(
    "/appointment-treatments/{appointment_treatment_id}/amend",
    status_code=status.HTTP_201_CREATED,
)
async def amend_appointment_treatment(
    appointment_treatment_id: int,
    body: TreatmentAmendCreate,
    user: Annotated[UserIdentity, Depends(require_role("Doctor"))],
) -> dict:
    async with with_transaction(staff_id=user.staff_id) as conn:
        data = await service.amend_treatment(
            conn, appointment_treatment_id, body, doctor_id=user.staff_id
        )
        if data is None:
            raise HTTPException(
                status_code=404,
                detail="Appointment treatment or treatment catalogue item not found",
            )
    return {"data": data, "error": None}


@router.patch("/appointments/{appointment_id}/notes")
async def update_appointment_notes(
    appointment_id: int,
    body: ConsultationNotesUpdate,
    user: Annotated[UserIdentity, Depends(require_role("Doctor"))],
) -> dict:
    async with with_transaction(staff_id=user.staff_id) as conn:
        data = await service.update_notes(
            conn, appointment_id, body, doctor_id=user.staff_id
        )
        if data is None:
            raise HTTPException(status_code=404, detail="Appointment not found")
    return {"data": data, "error": None}
