from datetime import date
from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import get_conn
from app.core.deps import require_role
from app.domains.auth.models import UserIdentity
from app.domains.report import service

router = APIRouter(prefix="/reports", tags=["reports"])


def _effective_branch_id(user: UserIdentity, requested_branch_id: int | None) -> int | None:
    if user.role != "Branch Manager":
        return requested_branch_id
    if user.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch Manager is not assigned to a branch",
        )
    if requested_branch_id is not None and requested_branch_id != user.branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch Manager can only access their assigned branch",
        )
    return user.branch_id


def _validate_dates(from_date: date | None, to_date: date | None) -> None:
    if from_date is not None and to_date is not None and from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from must be on or before to",
        )


@router.get("/appointments-summary")
async def appointments_summary(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict:
    _validate_dates(from_date, to_date)
    data = await service.appointments_summary(
        conn,
        branch_id=_effective_branch_id(user, branch_id),
        from_date=from_date,
        to_date=to_date,
    )
    return {"data": data, "error": None}


@router.get("/doctor-revenue")
async def doctor_revenue(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict:
    _validate_dates(from_date, to_date)
    data = await service.doctor_revenue(
        conn,
        branch_id=_effective_branch_id(user, branch_id),
        from_date=from_date,
        to_date=to_date,
    )
    return {"data": data, "error": None}


@router.get("/outstanding-balances")
async def outstanding_balances(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[
        UserIdentity,
        Depends(require_role("Admin", "Branch Manager", "Receptionist")),
    ],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
) -> dict:
    effective_branch_id = branch_id
    if _user.role == "Branch Manager":
        effective_branch_id = _effective_branch_id(_user, branch_id)
    data = await service.outstanding_balances(conn, branch_id=effective_branch_id)
    return {"data": data, "error": None}


@router.get("/treatment-frequency")
async def treatment_frequency(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    category: Annotated[str | None, Query(min_length=1, max_length=50)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict:
    _validate_dates(from_date, to_date)
    data = await service.treatment_frequency(
        conn,
        branch_id=_effective_branch_id(user, None),
        category=category,
        from_date=from_date,
        to_date=to_date,
    )
    return {"data": data, "error": None}


@router.get("/insurance-vs-outofpocket")
async def insurance_vs_outofpocket(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict:
    _validate_dates(from_date, to_date)
    data = await service.insurance_vs_outofpocket(
        conn,
        branch_id=_effective_branch_id(user, branch_id),
        from_date=from_date,
        to_date=to_date,
    )
    return {"data": data, "error": None}
