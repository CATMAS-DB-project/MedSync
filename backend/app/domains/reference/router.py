from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_conn
from app.core.deps import require_role
from app.domains.auth.models import UserIdentity
from app.domains.reference import service
from app.domains.reference.schemas import SpecialtyCreate, SpecialtyUpdate

router = APIRouter(tags=["reference"])


@router.get("/roles")
async def list_roles(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    return {"data": await service.list_roles(conn), "error": None}


@router.get("/specialties")
async def list_specialties(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[
        UserIdentity,
        Depends(
            require_role(
                "Admin",
                "Branch Manager",
                "Receptionist",
                "Doctor",
                "QA Tester",
            )
        ),
    ],
) -> dict:
    return {"data": await service.list_specialties(conn), "error": None}


@router.post("/specialties", status_code=status.HTTP_201_CREATED)
async def create_specialty(
    body: SpecialtyCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    data = await service.create_specialty(conn, body.specialty_name)
    return {"data": data, "error": None}


@router.patch("/specialties/{specialty_id}")
async def rename_specialty(
    specialty_id: int,
    body: SpecialtyUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    data = await service.rename_specialty(conn, specialty_id, body.specialty_name)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialty not found",
        )
    return {"data": data, "error": None}
