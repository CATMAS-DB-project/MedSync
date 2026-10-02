from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import get_conn
from app.core.deps import get_current_user, require_role
from app.core.pagination import list_response, pagination
from app.domains.auth.models import UserIdentity
from app.domains.staff import service
from app.domains.staff.schemas import (
    AccountCreate,
    AccountUpdate,
    DoctorPromote,
    EmploymentStatus,
    PasswordReset,
    PhoneCreate,
    SpecialtyLink,
    StaffCreate,
    StaffUpdate,
)

router = APIRouter(tags=["staff"])

MANAGERS = ("Admin", "Branch Manager")


@router.get("/staff")
async def list_staff(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
    pg: Annotated[dict[str, int], Depends(pagination)],
    branch_id: int | None = Query(None, gt=0),
    job_title: str | None = Query(None),
    employment_status: EmploymentStatus | None = Query(None),
    search: str | None = Query(None),
) -> dict:
    items, total = await service.list_staff(
        conn,
        pg["offset"],
        pg["limit"],
        branch_id,
        job_title,
        employment_status,
        search,
    )
    return {
        "data": list_response(items, total, pg["page"], pg["page_size"]),
        "error": None,
    }


@router.post("/staff", status_code=status.HTTP_201_CREATED)
async def create_staff(
    body: StaffCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    data = await service.create_staff(conn, body.model_dump())
    return {"data": data, "error": None}


@router.get("/staff/{staff_id}")
async def get_staff(
    staff_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    if user.role not in MANAGERS and user.staff_id != staff_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = await service.get_staff(conn, staff_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"data": data, "error": None}


@router.patch("/staff/{staff_id}")
async def update_staff(
    staff_id: int,
    body: StaffUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    data = await service.update_staff(
        conn,
        staff_id,
        body.model_dump(exclude_unset=True, exclude_none=True),
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"data": data, "error": None}


@router.get("/staff/{staff_id}/phones")
async def list_phones(
    staff_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    if user.role not in MANAGERS and user.staff_id != staff_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"data": await service.list_phones(conn, staff_id), "error": None}


@router.post(
    "/staff/{staff_id}/phones",
    status_code=status.HTTP_201_CREATED,
)
async def add_phone(
    staff_id: int,
    body: PhoneCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    if user.role not in MANAGERS and user.staff_id != staff_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = await service.add_phone(conn, staff_id, body.model_dump())
    return {"data": data, "error": None}


@router.delete(
    "/staff/{staff_id}/phones/{phone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_phone(
    staff_id: int,
    phone_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(get_current_user)],
) -> None:
    if user.role not in MANAGERS and user.staff_id != staff_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    deleted = await service.delete_phone(conn, staff_id, phone_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Phone not found")


@router.post(
    "/staff/{staff_id}/doctor",
    status_code=status.HTTP_201_CREATED,
)
async def promote_to_doctor(
    staff_id: int,
    body: DoctorPromote,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    data = await service.promote_to_doctor(conn, staff_id, body.model_dump())
    return {"data": data, "error": None}


@router.get("/staff/{staff_id}/doctor")
async def get_doctor(
    staff_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    data = await service.get_doctor(conn, staff_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"data": data, "error": None}


@router.post(
    "/staff/{staff_id}/doctor/specialties",
    status_code=status.HTTP_201_CREATED,
)
async def link_specialty(
    staff_id: int,
    body: SpecialtyLink,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    await service.link_specialty(conn, staff_id, body.specialty_id)
    return {
        "data": {"staff_id": staff_id, "specialty_id": body.specialty_id},
        "error": None,
    }


@router.delete(
    "/staff/{staff_id}/doctor/specialties/{specialty_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_specialty(
    staff_id: int,
    specialty_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> None:
    deleted = await service.unlink_specialty(conn, staff_id, specialty_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Link not found")


@router.get("/doctors")
async def list_doctors(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(get_current_user)],
    branch_id: int | None = Query(None, gt=0),
    specialty_id: int | None = Query(None, gt=0),
) -> dict:
    data = await service.list_doctors(conn, branch_id, specialty_id)
    return {"data": data, "error": None}


@router.post(
    "/staff/{staff_id}/account",
    status_code=status.HTTP_201_CREATED,
)
async def create_account(
    staff_id: int,
    body: AccountCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    data = await service.create_account(conn, staff_id, body.model_dump())
    if data is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"data": data, "error": None}


@router.patch("/staff/{staff_id}/account")
async def update_account(
    staff_id: int,
    body: AccountUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    data = await service.update_account(
        conn,
        staff_id,
        body.model_dump(exclude_unset=True, exclude_none=True),
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"data": data, "error": None}


@router.post(
    "/staff/{staff_id}/account/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reset_password(
    staff_id: int,
    body: PasswordReset,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> None:
    if not await service.reset_password(conn, staff_id, body.new_password):
        raise HTTPException(status_code=404, detail="Account not found")
