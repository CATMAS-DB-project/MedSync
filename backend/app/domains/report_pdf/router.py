"""FastAPI router endpoints for Report PDF generation and downloads."""

import asyncio
import io
from datetime import UTC, date, datetime
from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.db import get_conn
from app.core.deps import require_role
from app.domains.auth.models import UserIdentity
from app.domains.report import service as report_service
from app.domains.report.router import _effective_branch_id, _validate_dates
from app.domains.report_pdf.builders import (
    build_appointments_summary_pdf,
    build_doctor_revenue_pdf,
    build_insurance_summary_pdf,
    build_outstanding_balances_pdf,
    build_treatment_frequency_pdf,
)
from app.domains.report_pdf.schemas import ReportMetadata

router = APIRouter(prefix="/reports/pdf", tags=["reports-pdf"])


async def _resolve_branch_name(
    conn: PoolConnectionProxy,
    branch_id: int | None,
) -> str:
    """Helper to fetch the branch name for report headers."""
    if branch_id is None:
        return "All Branches (Consolidated)"
    row = await conn.fetchrow(
        "SELECT branch_name FROM branch WHERE branch_id = $1",
        branch_id,
    )
    return row["branch_name"] if row else f"Branch #{branch_id}"


async def _resolve_patient_name(
    conn: PoolConnectionProxy,
    patient_id: int | None,
) -> str | None:
    """Helper to fetch patient name when patient filter is active."""
    if patient_id is None:
        return None
    row = await conn.fetchrow(
        "SELECT first_name || ' ' || last_name AS name FROM patient WHERE patient_id = $1",
        patient_id,
    )
    return row["name"] if row else f"Patient #{patient_id}"


def _stream_pdf(buffer: io.BytesIO, filename: str) -> StreamingResponse:
    """Return a streaming response with proper PDF headers and disposition."""
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/appointments-summary")
async def export_appointments_summary_pdf(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> StreamingResponse:
    _validate_dates(from_date, to_date)
    effective_branch = _effective_branch_id(user, branch_id)
    branch_name = await _resolve_branch_name(conn, effective_branch)
    generated_at = datetime.now(UTC)

    # 1. Fetch raw data asynchronously on event loop
    data = await report_service.appointments_summary(
        conn,
        branch_id=effective_branch,
        from_date=from_date,
        to_date=to_date,
    )

    metadata = ReportMetadata(
        title="Appointments Summary Report",
        subtitle="Daily appointment volume and completion breakdown.",
        branch_id=effective_branch,
        branch_name=branch_name,
        from_date=from_date,
        to_date=to_date,
        generated_by=user.username,
        generated_at=generated_at,
    )

    # 2. Offload CPU-bound PDF generation to thread pool
    pdf_buffer = await asyncio.to_thread(
        build_appointments_summary_pdf,
        data=data,
        metadata=metadata,
    )

    filename = f"appointments_summary_{generated_at.strftime('%Y%m%d_%H%M%S')}.pdf"
    return _stream_pdf(pdf_buffer, filename)


@router.get("/doctor-revenue")
async def export_doctor_revenue_pdf(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> StreamingResponse:
    _validate_dates(from_date, to_date)
    effective_branch = _effective_branch_id(user, branch_id)
    branch_name = await _resolve_branch_name(conn, effective_branch)
    generated_at = datetime.now(UTC)

    data = await report_service.doctor_revenue(
        conn,
        branch_id=effective_branch,
        from_date=from_date,
        to_date=to_date,
    )

    metadata = ReportMetadata(
        title="Doctor Revenue & Productivity Report",
        subtitle="Ranked revenue and completed appointment volume per practitioner.",
        branch_id=effective_branch,
        branch_name=branch_name,
        from_date=from_date,
        to_date=to_date,
        generated_by=user.username,
        generated_at=generated_at,
    )

    pdf_buffer = await asyncio.to_thread(
        build_doctor_revenue_pdf,
        data=data,
        metadata=metadata,
    )

    filename = f"doctor_revenue_{generated_at.strftime('%Y%m%d_%H%M%S')}.pdf"
    return _stream_pdf(pdf_buffer, filename)


@router.get("/outstanding-balances")
async def export_outstanding_balances_pdf(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[
        UserIdentity,
        Depends(require_role("Admin", "Branch Manager", "Receptionist")),
    ],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    patient_id: Annotated[int | None, Query(gt=0)] = None,
) -> StreamingResponse:
    if user.role == "Receptionist" and patient_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Receptionists must provide patient_id",
        )

    effective_branch = _effective_branch_id(user, branch_id)
    branch_name = await _resolve_branch_name(conn, effective_branch)
    patient_name = await _resolve_patient_name(conn, patient_id)
    generated_at = datetime.now(UTC)

    data = await report_service.outstanding_balances(
        conn,
        branch_id=effective_branch,
        patient_id=patient_id,
    )

    subtitle = (
        f"Outstanding patient balance records for {patient_name}."
        if patient_id
        else "Comprehensive overdue and unpaid patient invoice ledger."
    )

    metadata = ReportMetadata(
        title="Outstanding Balances & Aging Ledger",
        subtitle=subtitle,
        branch_id=effective_branch,
        branch_name=branch_name,
        patient_id=patient_id,
        patient_name=patient_name,
        generated_by=user.username,
        generated_at=generated_at,
    )

    pdf_buffer = await asyncio.to_thread(
        build_outstanding_balances_pdf,
        data=data,
        metadata=metadata,
    )

    filename = f"outstanding_balances_{generated_at.strftime('%Y%m%d_%H%M%S')}.pdf"
    return _stream_pdf(pdf_buffer, filename)


@router.get("/treatment-frequency")
async def export_treatment_frequency_pdf(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    category: Annotated[str | None, Query(min_length=1, max_length=50)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> StreamingResponse:
    _validate_dates(from_date, to_date)
    effective_branch = _effective_branch_id(user, branch_id)
    branch_name = await _resolve_branch_name(conn, effective_branch)
    generated_at = datetime.now(UTC)

    data = await report_service.treatment_frequency(
        conn,
        branch_id=effective_branch,
        category=category,
        from_date=from_date,
        to_date=to_date,
    )

    metadata = ReportMetadata(
        title="Treatment & Service Utilization Report",
        subtitle="Frequency of delivered treatments and catalog popularity.",
        branch_id=effective_branch,
        branch_name=branch_name,
        category=category,
        from_date=from_date,
        to_date=to_date,
        generated_by=user.username,
        generated_at=generated_at,
    )

    pdf_buffer = await asyncio.to_thread(
        build_treatment_frequency_pdf,
        data=data,
        metadata=metadata,
    )

    filename = f"treatment_frequency_{generated_at.strftime('%Y%m%d_%H%M%S')}.pdf"
    return _stream_pdf(pdf_buffer, filename)


@router.get("/insurance-summary")
async def export_insurance_summary_pdf(
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],
    branch_id: Annotated[int | None, Query(gt=0)] = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> StreamingResponse:
    _validate_dates(from_date, to_date)
    effective_branch = _effective_branch_id(user, branch_id)
    branch_name = await _resolve_branch_name(conn, effective_branch)
    generated_at = datetime.now(UTC)

    data = await report_service.insurance_vs_outofpocket(
        conn,
        branch_id=effective_branch,
        from_date=from_date,
        to_date=to_date,
    )

    metadata = ReportMetadata(
        title="Insurance vs. Out-of-Pocket Financial Summary",
        subtitle="Consolidated comparison of insurance contributions against direct patient liabilities.",
        branch_id=effective_branch,
        branch_name=branch_name,
        from_date=from_date,
        to_date=to_date,
        generated_by=user.username,
        generated_at=generated_at,
    )

    pdf_buffer = await asyncio.to_thread(
        build_insurance_summary_pdf,
        data=data,
        metadata=metadata,
    )

    filename = f"insurance_summary_{generated_at.strftime('%Y%m%d_%H%M%S')}.pdf"
    return _stream_pdf(pdf_buffer, filename)
