from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import get_conn
from app.core.deps import require_role
from app.core.pagination import pagination
from app.domains.auth.models import UserIdentity
from app.domains.guardians.schemas import GuardianCreate, GuardianPhoneCreate, GuardianUpdate

router = APIRouter(tags=["guardians"])
RECEPTION = Depends(require_role("Receptionist"))


def _success(data: object) -> dict:
    return {"data": data, "error": None}


def _success_list(items: list, total: int, page: int, page_size: int) -> dict:
    return _success({"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/guardians")
async def list_guardians(conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION], paging: Annotated[dict[str, int], Depends(pagination)], search: str | None = Query(default=None, max_length=100)):
    term = search.strip() if search else None
    rows = await conn.fetch("""SELECT guardian_id, first_name, last_name, nic, address, created_at,
        COUNT(*) OVER() AS total FROM guardian
        WHERE $1::text IS NULL OR first_name ILIKE '%' || $1 || '%'
          OR last_name ILIKE '%' || $1 || '%' OR nic ILIKE '%' || $1 || '%'
        ORDER BY last_name, first_name, guardian_id LIMIT $2 OFFSET $3""", term, paging["limit"], paging["offset"])
    return _success_list([dict(r) for r in rows], rows[0]["total"] if rows else 0, paging["page"], paging["page_size"])


@router.post("/guardians", status_code=status.HTTP_201_CREATED)
async def create_guardian(body: GuardianCreate, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    row = await conn.fetchrow("""INSERT INTO guardian(first_name,last_name,nic,address)
        VALUES($1,$2,$3,$4) RETURNING guardian_id,first_name,last_name,nic,address,created_at""", body.first_name, body.last_name, body.nic, body.address)
    return _success(dict(row))


@router.get("/guardians/{guardian_id}")
async def get_guardian(guardian_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    row = await conn.fetchrow("""SELECT g.guardian_id,g.first_name,g.last_name,g.nic,g.address,g.created_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('phone_id',gp.phone_id,'phone_number',gp.phone_number,'phone_type',gp.phone_type) ORDER BY gp.phone_id) FROM guardian_phone gp WHERE gp.guardian_id=g.guardian_id),'[]'::jsonb) AS phones,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('patient_id',p.patient_id,'first_name',p.first_name,'last_name',p.last_name,'nic_passport_no',p.nic_passport_no,'relationship',pg.relationship) ORDER BY p.patient_id) FROM patient_guardian pg JOIN patient p USING(patient_id) WHERE pg.guardian_id=g.guardian_id),'[]'::jsonb) AS patients
        FROM guardian g WHERE g.guardian_id=$1""", guardian_id)
    if not row:
        raise HTTPException(status_code=404, detail="Guardian not found")
    return _success(dict(row))


@router.patch("/guardians/{guardian_id}")
async def update_guardian(guardian_id: int, body: GuardianUpdate, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    fields = body.model_dump(exclude_unset=True)
    allowed = {"first_name", "last_name", "nic", "address"}
    sets, values = [], [guardian_id]
    for key, value in fields.items():
        if key not in allowed:
            continue
        values.append(value)
        sets.append(f"{key} = ${len(values)}")
    row = await conn.fetchrow(f"UPDATE guardian SET {', '.join(sets)} WHERE guardian_id=$1 RETURNING guardian_id,first_name,last_name,nic,address,created_at", *values)
    if not row:
        raise HTTPException(status_code=404, detail="Guardian not found")
    return _success(dict(row))


@router.get("/guardians/{guardian_id}/phones")
async def list_guardian_phones(guardian_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION], paging: Annotated[dict[str, int], Depends(pagination)]):
    if not await conn.fetchval("SELECT 1 FROM guardian WHERE guardian_id=$1", guardian_id):
        raise HTTPException(status_code=404, detail="Guardian not found")
    rows = await conn.fetch("SELECT phone_id,guardian_id,phone_number,phone_type FROM guardian_phone WHERE guardian_id=$1 ORDER BY phone_id LIMIT $2 OFFSET $3", guardian_id, paging["limit"], paging["offset"])
    total = await conn.fetchval("SELECT count(*) FROM guardian_phone WHERE guardian_id=$1", guardian_id)
    return _success_list([dict(r) for r in rows], total, paging["page"], paging["page_size"])


@router.post("/guardians/{guardian_id}/phones", status_code=status.HTTP_201_CREATED)
async def add_guardian_phone(guardian_id: int, body: GuardianPhoneCreate, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    if not await conn.fetchval("SELECT 1 FROM guardian WHERE guardian_id=$1", guardian_id):
        raise HTTPException(status_code=404, detail="Guardian not found")
    row = await conn.fetchrow("INSERT INTO guardian_phone(guardian_id,phone_number,phone_type) VALUES($1,$2,$3) RETURNING phone_id,guardian_id,phone_number,phone_type", guardian_id, body.phone_number, body.phone_type)
    return _success(dict(row))
