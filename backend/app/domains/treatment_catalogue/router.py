from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import get_conn
from app.core.deps import require_role
from app.core.pagination import list_response, pagination
from app.domains.auth.models import UserIdentity
from app.domains.treatment_catalogue import service
from app.domains.treatment_catalogue.schemas import TreatmentCreate, TreatmentUpdate

router = APIRouter(tags=["treatment-catalogue"])
ALL_ROLES = ("Admin", "Branch Manager", "Receptionist", "Doctor", "QA Tester")
MANAGERS = ("Admin", "Branch Manager")


@router.get("/treatments")
async def list_treatments(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*ALL_ROLES))],
    paging: Annotated[dict[str, int], Depends(pagination)],
    category: str | None = Query(default=None, min_length=1, max_length=50),
) -> dict:
    items, total = await service.list_treatments(
        conn, paging["offset"], paging["limit"], category
    )
    return {
        "data": list_response(items, total, paging["page"], paging["page_size"]),
        "error": None,
    }


@router.post("/treatments", status_code=status.HTTP_201_CREATED)
async def create_treatment(
    body: TreatmentCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    data = await service.create_treatment(conn, body.model_dump())
    return {"data": data, "error": None}


@router.get("/treatments/{service_code}")
async def get_treatment(
    service_code: str,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*ALL_ROLES))],
) -> dict:
    data = await service.get_treatment(conn, service_code)
    if data is None:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return {"data": data, "error": None}


@router.patch("/treatments/{service_code}")
async def update_treatment(
    service_code: str,
    body: TreatmentUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role(*MANAGERS))],
) -> dict:
    data = await service.update_treatment(
        conn,
        service_code,
        body.model_dump(exclude_unset=True, exclude_none=True),
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return {"data": data, "error": None}
