from typing import Annotated, Any

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from app.core.db import get_conn
from app.core.deps import require_role
from app.core.pagination import pagination
from app.domains.auth.models import UserIdentity
from app.domains.patients import service
from app.domains.patients.schemas import (
    InsuranceCreate,
    InsuranceUpdate,
    PatientCreate,
    PatientGuardianLink,
    PatientUpdate,
    PhoneCreate,
)

router = APIRouter(tags=["patients"])


def _success(data: Any) -> dict:
    return {"data": data, "error": None}


def _success_list(items: list, total: int, page: int, page_size: int) -> dict:
    return _success({"items": items, "total": total, "page": page, "page_size": page_size})

PATIENT_READ = ("Receptionist", "Doctor", "Admin", "Branch Manager")


def _duplicate_nic(patient_id: int) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "data": None,
            "error": {
                "code": "patient_already_registered",
                "message": "A patient with this NIC/passport number is already registered",
                "patient_id": patient_id,
            },
        },
    )


async def _require_patient(
    conn: PoolConnectionProxy, patient_id: int, user: UserIdentity | None = None
) -> None:
    branch_id = await conn.fetchval(
        "SELECT registered_branch_id FROM patient WHERE patient_id = $1",
        patient_id,
    )
    if branch_id is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    if user and user.role == "Branch Manager" and (
        user.branch_id is None or branch_id != user.branch_id
    ):
        raise HTTPException(status_code=403, detail="Patient is outside your branch")


@router.get("/patients")
async def list_patients(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role(*PATIENT_READ))],
    paging: Annotated[dict[str, int], Depends(pagination)],
    search: str | None = Query(default=None, max_length=100),
    branch_id: int | None = Query(default=None, ge=1),
) -> dict:
    if user.role == "Branch Manager":
        if user.branch_id is None:
            raise HTTPException(status_code=403, detail="Branch Manager is not assigned to a branch")
        if branch_id is not None and branch_id != user.branch_id:
            raise HTTPException(status_code=403, detail="Branch Manager can only list patients from their branch")
        branch_id = user.branch_id
    items, total = await service.list_patients(
        conn,
        search.strip() if search and search.strip() else None,
        branch_id,
        paging["offset"],
        paging["limit"],
    )
    return _success_list(items, total, paging["page"], paging["page_size"])


@router.post("/patients", status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> Any:
    try:
        patient = await service.create_patient(body.model_dump(), user.staff_id)
    except service.DuplicatePatientNIC as error:
        return _duplicate_nic(error.patient_id)
    return _success(patient)


@router.get("/patients/{patient_id}")
async def get_patient(
    patient_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role(*PATIENT_READ))],
) -> dict:
    await _require_patient(conn, patient_id, user)
    patient = await service.get_patient(conn, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _success(patient)


@router.patch("/patients/{patient_id}")
async def patch_patient(
    patient_id: int,
    body: PatientUpdate,
    user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> Any:
    try:
        patient = await service.update_patient(
            patient_id, body.model_dump(exclude_unset=True), user.staff_id
        )
    except service.DuplicatePatientNIC as error:
        return _duplicate_nic(error.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _success(patient)


@router.get("/patients/{patient_id}/phones")
async def list_patient_phones(
    patient_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[
        UserIdentity,
        Depends(require_role("Receptionist", "Doctor", "Admin")),
    ],
    paging: Annotated[dict[str, int], Depends(pagination)],
) -> dict:
    await _require_patient(conn, patient_id, user)
    items = await service.list_patient_phones(
        conn, patient_id, paging["offset"], paging["limit"]
    )
    total = await service.count_patient_phones(conn, patient_id)
    return _success_list(items, total, paging["page"], paging["page_size"])


@router.post("/patients/{patient_id}/phones", status_code=status.HTTP_201_CREATED)
async def add_patient_phone(
    patient_id: int,
    body: PhoneCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    phone = await service.add_patient_phone(conn, patient_id, body.model_dump())
    if phone is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _success(phone)


@router.delete("/patients/{patient_id}/phones/{phone_id}")
async def delete_patient_phone(
    patient_id: int,
    phone_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    removed = await service.remove_patient_phone(conn, patient_id, phone_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Patient phone not found")
    return _success({"deleted": True, "phone_id": phone_id})


@router.get("/patients/{patient_id}/guardians")
async def list_linked_guardians(
    patient_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist", "Doctor"))],
    paging: Annotated[dict[str, int], Depends(pagination)],
) -> dict:
    await _require_patient(conn, patient_id)
    items = await service.list_patient_guardians(
        conn, patient_id, paging["offset"], paging["limit"]
    )
    total = await service.count_patient_guardians(conn, patient_id)
    return _success_list(items, total, paging["page"], paging["page_size"])


@router.post(
    "/patients/{patient_id}/guardians", status_code=status.HTTP_201_CREATED
)
async def link_guardian(
    patient_id: int,
    body: PatientGuardianLink,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    link = await service.link_patient_guardian(
        conn, patient_id, body.model_dump(exclude_none=True)
    )
    if link is None:
        raise HTTPException(
            status_code=404,
            detail="Patient or guardian not found",
        )
    if link.get("already_linked"):
        raise HTTPException(status_code=409, detail="Guardian is already linked to patient")
    return _success(link)


@router.delete("/patients/{patient_id}/guardians/{guardian_id}")
async def unlink_guardian(
    patient_id: int,
    guardian_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    removed = await service.unlink_patient_guardian(conn, patient_id, guardian_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Patient guardian link not found")
    return _success({"deleted": True, "guardian_id": guardian_id})


@router.get("/patients/{patient_id}/insurance")
async def list_patient_insurance(
    patient_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
    paging: Annotated[dict[str, int], Depends(pagination)],
) -> dict:
    await _require_patient(conn, patient_id)
    items = await service.list_patient_insurance(
        conn, patient_id, paging["offset"], paging["limit"]
    )
    total = await service.count_patient_insurance(conn, patient_id)
    return _success_list(items, total, paging["page"], paging["page_size"])


@router.post(
    "/patients/{patient_id}/insurance", status_code=status.HTTP_201_CREATED
)
async def add_patient_insurance(
    patient_id: int,
    body: InsuranceCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    policy = await service.add_patient_insurance(
        conn, patient_id, body.model_dump()
    )
    if policy is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _success(policy)


@router.patch("/patients/{patient_id}/insurance/{policy_id}")
async def patch_patient_insurance(
    patient_id: int,
    policy_id: str,
    body: InsuranceUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    policy = await service.update_patient_insurance(
        conn, patient_id, policy_id, body.model_dump(exclude_unset=True)
    )
    if policy is None:
        raise HTTPException(status_code=404, detail="Insurance policy not found")
    return _success(policy)


@router.get("/patients/{patient_id}/appointments")
async def list_patient_appointments(
    patient_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[
        UserIdentity,
        Depends(require_role("Receptionist", "Doctor", "Admin", "Branch Manager")),
    ],
    paging: Annotated[dict[str, int], Depends(pagination)],
) -> dict:
    await _require_patient(conn, patient_id, user)
    items, total = await service.list_patient_appointments(
        conn,
        patient_id,
        paging["offset"],
        paging["limit"],
        user.branch_id if user.role == "Branch Manager" else None,
    )
    return _success_list(items, total, paging["page"], paging["page_size"])
