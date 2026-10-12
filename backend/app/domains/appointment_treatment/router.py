from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

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
    body: list[object],
    user: Annotated[UserIdentity, Depends(require_role("Doctor"))],
) -> dict:
    created: list[dict[str, object]] = []
    failed: list[dict[str, object]] = []

    async with with_transaction(staff_id=user.staff_id) as conn:
        for index, item in enumerate(body):
            try:
                treatment = TreatmentLogCreate.model_validate(item)
            except ValidationError as exc:
                message = "; ".join(
                    f"{'.'.join(str(part) for part in error['loc'])}: "
                    f"{error['msg']}"
                    for error in exc.errors()
                )
                failed.append({"index": index, "error": message})
                continue

            data = await service.create_treatment(
                conn, appointment_id, treatment, doctor_id=user.staff_id
            )
            if data is None:
                failed.append(
                    {
                        "index": index,
                        "service_code": treatment.service_code,
                        "error": (
                            "Appointment or treatment catalogue item not found"
                        ),
                    }
                )
                continue
            created.append(data)

    return {
        "data": {"created": created, "failed": failed},
        "error": None,
    }


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
