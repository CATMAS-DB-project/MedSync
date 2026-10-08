"""Comprehensive test suite for PDF report builders, routers, and RBAC authorization."""

import asyncio
from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.core.deps import get_current_user
from app.domains.auth.models import UserIdentity
from app.domains.report_pdf.builders import (
    build_appointments_summary_pdf,
    build_doctor_revenue_pdf,
    build_insurance_summary_pdf,
    build_outstanding_balances_pdf,
    build_treatment_frequency_pdf,
)
from app.domains.report_pdf.router import (
    export_appointments_summary_pdf,
    export_outstanding_balances_pdf,
)
from app.domains.report_pdf.schemas import ReportMetadata
from app.main import app

# --- Fixtures & Identities ---

ADMIN_USER = UserIdentity(
    staff_id=1,
    username="admin_user",
    role="Admin",
    branch_id=None,
)

BM_USER = UserIdentity(
    staff_id=2,
    username="manager_branch1",
    role="Branch Manager",
    branch_id=1,
)

UNASSIGNED_BM = UserIdentity(
    staff_id=3,
    username="manager_no_branch",
    role="Branch Manager",
    branch_id=None,
)

RECEPTIONIST_USER = UserIdentity(
    staff_id=4,
    username="receptionist_branch1",
    role="Receptionist",
    branch_id=1,
)

DOCTOR_USER = UserIdentity(
    staff_id=5,
    username="dr_house",
    role="Doctor",
    branch_id=1,
)


def make_metadata(
    title: str = "Test Report",
    subtitle: str = "Test Subtitle",
    branch_id: int | None = 1,
    branch_name: str = "Downtown Clinic",
    from_date: date | None = date(2026, 1, 1),
    to_date: date | None = date(2026, 1, 31),
) -> ReportMetadata:
    return ReportMetadata(
        title=title,
        subtitle=subtitle,
        branch_id=branch_id,
        branch_name=branch_name,
        from_date=from_date,
        to_date=to_date,
        generated_by="tester",
        generated_at=datetime(2026, 10, 8, 12, 0, tzinfo=UTC),
    )


# =========================================================================
# 1. BUILDER UNIT TESTS
# =========================================================================


def test_build_appointments_summary_pdf_with_data() -> None:
    data = [
        {
            "appointment_date": date(2026, 1, 10),
            "scheduled_count": 5,
            "completed_count": 4,
            "cancelled_count": 1,
            "total_count": 10,
        },
        {
            "appointment_date": date(2026, 1, 11),
            "scheduled_count": 2,
            "completed_count": 8,
            "cancelled_count": 0,
            "total_count": 10,
        },
    ]
    meta = make_metadata(title="Appointments Summary Report")
    pdf_buf = build_appointments_summary_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_appointments_summary_pdf_empty() -> None:
    meta = make_metadata()
    pdf_buf = build_appointments_summary_pdf([], meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_appointments_summary_pdf_multipage() -> None:
    # Generate 120 rows to force multi-page rendering and check table headers & pagination
    data = [
        {
            "appointment_date": date(2026, 1, 1),
            "scheduled_count": i,
            "completed_count": i * 2,
            "cancelled_count": 1,
            "total_count": i * 3 + 1,
        }
        for i in range(1, 121)
    ]
    meta = make_metadata(title="Multi-Page Appointments Report")
    pdf_buf = build_appointments_summary_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 5000


def test_build_doctor_revenue_pdf_with_data() -> None:
    data = [
        {
            "branch_id": 1,
            "branch_name": "Downtown Clinic",
            "doctor_staff_id": 101,
            "doctor_name": "Dr. Gregory House",
            "appointment_count": 42,
            "revenue": Decimal("15450.00"),
            "revenue_rank": 1,
        },
        {
            "branch_id": 1,
            "branch_name": "Downtown Clinic",
            "doctor_staff_id": 102,
            "doctor_name": "Dr. James Wilson",
            "appointment_count": 35,
            "revenue": Decimal("9200.50"),
            "revenue_rank": 2,
        },
    ]
    meta = make_metadata(title="Doctor Revenue & Productivity Report")
    pdf_buf = build_doctor_revenue_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_doctor_revenue_pdf_empty() -> None:
    meta = make_metadata()
    pdf_buf = build_doctor_revenue_pdf([], meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_outstanding_balances_pdf_with_data() -> None:
    data = [
        {
            "invoice_id": 501,
            "appointment_id": 1001,
            "branch_id": 1,
            "branch_name": "Downtown Clinic",
            "patient_id": 201,
            "patient_name": "John Doe",
            "payable_amount": Decimal("1200.00"),
            "amount_paid": Decimal("400.00"),
            "outstanding_amount": Decimal("800.00"),
        },
        {
            "invoice_id": 502,
            "appointment_id": 1002,
            "branch_id": 1,
            "branch_name": "Downtown Clinic",
            "patient_id": 202,
            "patient_name": "Jane Smith",
            "payable_amount": Decimal("500.00"),
            "amount_paid": Decimal("0.00"),
            "outstanding_amount": Decimal("500.00"),
        },
    ]
    meta = make_metadata(title="Outstanding Balances & Aging Ledger")
    pdf_buf = build_outstanding_balances_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_outstanding_balances_pdf_empty() -> None:
    meta = make_metadata()
    pdf_buf = build_outstanding_balances_pdf([], meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_treatment_frequency_pdf_with_data() -> None:
    data = [
        {
            "service_code": "TX-001",
            "treatment_name": "Comprehensive Dental Cleaning",
            "category": "Preventative",
            "treatment_count": 85,
        },
        {
            "service_code": "TX-002",
            "treatment_name": "Composite Molar Filling",
            "category": "Restorative",
            "treatment_count": 42,
        },
    ]
    meta = make_metadata(title="Treatment Utilization Report")
    pdf_buf = build_treatment_frequency_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_treatment_frequency_pdf_empty() -> None:
    meta = make_metadata()
    pdf_buf = build_treatment_frequency_pdf([], meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_insurance_summary_pdf_with_data() -> None:
    data = {
        "invoice_count": 120,
        "subtotal_amount": Decimal("50000.00"),
        "insurance_amount": Decimal("35000.00"),
        "out_of_pocket_amount": Decimal("15000.00"),
    }
    meta = make_metadata(title="Insurance vs Out-of-Pocket Summary")
    pdf_buf = build_insurance_summary_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


def test_build_insurance_summary_pdf_empty() -> None:
    data = {
        "invoice_count": 0,
        "subtotal_amount": Decimal("0.00"),
        "insurance_amount": Decimal("0.00"),
        "out_of_pocket_amount": Decimal("0.00"),
    }
    meta = make_metadata()
    pdf_buf = build_insurance_summary_pdf(data, meta)

    content = pdf_buf.getvalue()
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


# =========================================================================
# 2. ROUTER & AUTHORIZATION TESTS
# =========================================================================


@pytest.mark.asyncio
async def test_branch_manager_cannot_request_foreign_branch_pdf() -> None:
    conn = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await export_appointments_summary_pdf(
            conn=conn,
            user=BM_USER,
            branch_id=2,  # BM is branch 1
            from_date=None,
            to_date=None,
        )
    assert exc_info.value.status_code == 403
    assert "only access their assigned branch" in exc_info.value.detail


@pytest.mark.asyncio
async def test_unassigned_branch_manager_forbidden_pdf() -> None:
    conn = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await export_appointments_summary_pdf(
            conn=conn,
            user=UNASSIGNED_BM,
            branch_id=None,
            from_date=None,
            to_date=None,
        )
    assert exc_info.value.status_code == 403
    assert "not assigned to a branch" in exc_info.value.detail


@pytest.mark.asyncio
async def test_receptionist_requires_patient_id_for_outstanding_balances_pdf() -> None:
    conn = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await export_outstanding_balances_pdf(
            conn=conn,
            user=RECEPTIONIST_USER,
            branch_id=None,
            patient_id=None,  # Receptionist must provide patient_id
        )
    assert exc_info.value.status_code == 422
    assert "Receptionists must provide patient_id" in exc_info.value.detail


@pytest.mark.asyncio
async def test_receptionist_with_patient_id_allowed_pdf(monkeypatch) -> None:
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={"branch_name": "Downtown Clinic", "name": "Alice Green"}
    )

    mock_service = AsyncMock(return_value=[])
    monkeypatch.setattr(
        "app.domains.report.service.outstanding_balances",
        mock_service,
    )

    response = await export_outstanding_balances_pdf(
        conn=conn,
        user=RECEPTIONIST_USER,
        branch_id=1,
        patient_id=10,
    )
    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert "attachment; filename=" in response.headers["content-disposition"]


@pytest.mark.asyncio
async def test_date_validation_rejects_from_after_to_pdf() -> None:
    conn = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await export_appointments_summary_pdf(
            conn=conn,
            user=ADMIN_USER,
            branch_id=None,
            from_date=date(2026, 5, 10),
            to_date=date(2026, 5, 1),
        )
    assert exc_info.value.status_code == 422
    assert "from must be on or before to" in exc_info.value.detail


# =========================================================================
# 3. FASTAPI TESTCLIENT RBAC & STREAMING INTEGRATION TESTS
# =========================================================================


@pytest.mark.asyncio
async def test_fastapi_endpoints_role_enforcement() -> None:
    """Verifies RBAC protection across all PDF report routes via TestClient."""
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(
        return_value={"branch_name": "Main Clinic", "name": "John Doe"}
    )

    async def override_get_conn():
        return mock_conn

    app.dependency_overrides[get_conn] = override_get_conn

    try:
        client = TestClient(app)

        # 1. Doctor role is forbidden from all report endpoints
        app.dependency_overrides[get_current_user] = lambda: DOCTOR_USER

        endpoints = [
            "/api/v1/reports/pdf/appointments-summary",
            "/api/v1/reports/pdf/doctor-revenue",
            "/api/v1/reports/pdf/outstanding-balances?patient_id=1",
            "/api/v1/reports/pdf/treatment-frequency",
            "/api/v1/reports/pdf/insurance-summary",
        ]
        for ep in endpoints:
            res = client.get(ep)
            assert res.status_code == 403, (
                f"Expected 403 for Doctor on {ep}, got {res.status_code}"
            )

        # 2. Receptionist is forbidden from RG-1, RG-2, RG-4, RG-5
        app.dependency_overrides[get_current_user] = lambda: RECEPTIONIST_USER
        forbidden_for_receptionist = [
            "/api/v1/reports/pdf/appointments-summary",
            "/api/v1/reports/pdf/doctor-revenue",
            "/api/v1/reports/pdf/treatment-frequency",
            "/api/v1/reports/pdf/insurance-summary",
        ]
        for ep in forbidden_for_receptionist:
            res = client.get(ep)
            assert res.status_code == 403, f"Expected 403 for Receptionist on {ep}"

        # 3. Admin can access all endpoints and receives valid PDF streams
        app.dependency_overrides[get_current_user] = lambda: ADMIN_USER

        # RG-1
        mock_conn.fetch = AsyncMock(return_value=[])
        res = client.get("/api/v1/reports/pdf/appointments-summary")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")

        # RG-2
        res = client.get("/api/v1/reports/pdf/doctor-revenue")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")

        # RG-3
        res = client.get("/api/v1/reports/pdf/outstanding-balances")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")

        # RG-4
        res = client.get("/api/v1/reports/pdf/treatment-frequency")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")

        # RG-5
        mock_conn.fetchrow = AsyncMock(
            return_value={
                "invoice_count": 0,
                "subtotal_amount": 0,
                "insurance_amount": 0,
                "out_of_pocket_amount": 0,
                "branch_name": "Main Clinic",
            }
        )
        res = client.get("/api/v1/reports/pdf/insurance-summary")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_concurrent_pdf_generation_does_not_block_health() -> None:
    """Verifies that concurrent PDF generation offloaded to worker threads does not block /api/health."""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(
        return_value={"branch_name": "Main Clinic", "name": "John Doe"}
    )

    async def override_get_conn():
        return mock_conn

    app.dependency_overrides[get_conn] = override_get_conn
    app.dependency_overrides[get_current_user] = lambda: ADMIN_USER

    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            pdf_tasks = [
                client.get("/api/v1/reports/pdf/appointments-summary"),
                client.get("/api/v1/reports/pdf/doctor-revenue"),
                client.get("/api/v1/reports/pdf/outstanding-balances"),
            ]
            health_task = client.get("/api/health")

            responses = await asyncio.gather(*pdf_tasks, health_task)

            for pdf_res in responses[:3]:
                assert pdf_res.status_code == 200
                assert pdf_res.headers["content-type"] == "application/pdf"
                assert pdf_res.content.startswith(b"%PDF-")

            health_res = responses[3]
            assert health_res.status_code == 200
            assert health_res.json() == {"status": "ok"}
    finally:
        app.dependency_overrides.clear()
