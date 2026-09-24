from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends

from app.core.db import get_conn
from app.core.deps import require_role
from app.domains.auth.models import UserIdentity
from app.domains.reference import service

router = APIRouter(prefix="/roles", tags=["reference"])


@router.get("")
async def list_roles(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    return {"data": await service.list_roles(conn), "error": None}
