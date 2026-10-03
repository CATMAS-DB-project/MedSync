from datetime import datetime
from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, Query, HTTPException

from app.core.db import get_conn
from app.core.deps import require_role
from app.core.pagination import pagination
from app.domains.auth.models import UserIdentity

router = APIRouter(tags=["audit"])
AUDIT = Depends(require_role("Admin", "QA Tester"))


def _success(data: object) -> dict:
    return {"data": data, "error": None}


def _success_list(items: list, total: int, page: int, page_size: int) -> dict:
    return _success({"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/audit-logs")
async def list_audit_logs(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, AUDIT],
    paging: Annotated[dict[str, int], Depends(pagination)],
    staff_id: int | None = Query(default=None, ge=1),
    action_type: str | None = Query(default=None, max_length=20),
    table_affected: str | None = Query(default=None, max_length=50),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    record_id: str | None = Query(default=None, max_length=30),
):
    if from_time and to_time and from_time > to_time:
        raise HTTPException(422, "from must be earlier than or equal to to")
    rows = await conn.fetch("""SELECT l.log_id,l.staff_id,l.action_type,l.table_affected,
        l.record_id_affected,l.log_timestamp,COUNT(*) OVER() AS total
        FROM audit_log l WHERE ($1::int IS NULL OR l.staff_id=$1)
          AND ($2::text IS NULL OR l.action_type::text=$2)
          AND ($3::text IS NULL OR l.table_affected=$3)
          AND ($4::timestamptz IS NULL OR l.log_timestamp >= $4)
          AND ($5::timestamptz IS NULL OR l.log_timestamp <= $5)
          AND ($6::text IS NULL OR l.record_id_affected=$6)
        ORDER BY l.log_timestamp DESC,l.log_id DESC LIMIT $7 OFFSET $8""",
        staff_id, action_type, table_affected, from_time, to_time, record_id,
        paging["limit"], paging["offset"])
    return _success_list([dict(r) for r in rows], rows[0]["total"] if rows else 0, paging["page"], paging["page_size"])


@router.get("/audit-logs/{log_id}")
async def get_audit_log(log_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, AUDIT]):
    row = await conn.fetchrow("""SELECT log_id,staff_id,action_type,table_affected,
        record_id_affected,log_timestamp,details FROM audit_log WHERE log_id=$1""", log_id)
    if not row:
        raise HTTPException(404, "Audit log entry not found")
    return _success(dict(row))
