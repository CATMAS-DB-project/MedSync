from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_conn
from app.core.deps import get_current_user, require_role
from app.domains.auth.models import UserIdentity
from app.domains.branches import service
from app.domains.branches.schemas import BranchCreate, BranchUpdate

router = APIRouter(prefix="/branches", tags=["branches"])


def _success(data: object) -> dict:
    return {"data": data, "error": None}


@router.get("")
async def list_branches(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    items = await service.list_branches(conn)
    return _success({"items": items, "total": len(items)})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_branch(
    body: BranchCreate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    return _success(await service.create_branch(conn, body.model_dump()))


@router.get("/{branch_id}")
async def get_branch(
    branch_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(get_current_user)],
) -> dict:
    data = await service.get_branch(conn, branch_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return _success(data)


@router.patch("/{branch_id}")
async def patch_branch(
    branch_id: int,
    body: BranchUpdate,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Admin"))],
) -> dict:
    data = await service.update_branch(
        conn, branch_id, body.model_dump(exclude_unset=True)
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return _success(data)
