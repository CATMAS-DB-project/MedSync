from datetime import datetime
from typing import Annotated

from asyncpg.pool import PoolConnectionProxy
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import get_conn, with_transaction
from app.core.deps import require_role
from app.core.pagination import pagination
from app.domains.auth.models import UserIdentity
from app.domains.billing.schemas import ClaimCreate, InvoiceFinalize, PaymentCreate

router = APIRouter(tags=["billing"])
BILLING_READ = Depends(require_role("Receptionist", "Admin", "Branch Manager"))
RECEPTION = Depends(require_role("Receptionist"))


def _success(data: object) -> dict:
    return {"data": data, "error": None}


def _success_list(items: list, total: int, page: int, page_size: int) -> dict:
    return _success({"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/invoices")
async def list_invoices(conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, BILLING_READ], paging: Annotated[dict[str, int], Depends(pagination)], status_filter: str | None = Query(default=None, alias="status"), branch_id: int | None = Query(default=None, ge=1), patient_id: int | None = Query(default=None, ge=1)):
    rows = await conn.fetch("""SELECT v.*, a.patient_id, a.branch_id, COUNT(*) OVER() AS total
        FROM v_invoice_outstanding v JOIN appointment a USING(appointment_id)
        WHERE ($1::text IS NULL OR v.status::text=$1) AND ($2::int IS NULL OR a.branch_id=$2)
          AND ($3::int IS NULL OR a.patient_id=$3)
        ORDER BY v.invoice_id DESC LIMIT $4 OFFSET $5""", status_filter, branch_id, patient_id, paging["limit"], paging["offset"])
    return _success_list([dict(r) for r in rows], rows[0]["total"] if rows else 0, paging["page"], paging["page_size"])


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, BILLING_READ]):
    row = await conn.fetchrow("""SELECT v.*, a.patient_id, a.branch_id, a.appointment_date
        FROM v_invoice_outstanding v JOIN appointment a USING(appointment_id) WHERE v.invoice_id=$1""", invoice_id)
    if not row:
        raise HTTPException(404, "Invoice not found")
    data = dict(row)
    lines = await conn.fetch("""SELECT t.appointment_treatment_id,t.service_code,c.treatment_name,
        t.price_at_time,t.is_amended,t.original_record_id
        FROM appointment_treatment t JOIN treatment_catalogue c USING(service_code)
        WHERE t.appointment_id=$1 ORDER BY t.appointment_treatment_id""", row["appointment_id"])
    data["line_items"] = [dict(r) for r in lines]
    return _success(data)


@router.post("/invoices/{invoice_id}/finalize")
async def finalize_invoice(invoice_id: int, body: InvoiceFinalize, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], user: Annotated[UserIdentity, RECEPTION]):
    async with with_transaction(staff_id=user.staff_id) as tx:
        row = await tx.fetchrow("""UPDATE invoice SET insurance_deduction=$2, manual_discount=$3,
            status='Finalized', finalized_by_staff_id=$4
            WHERE invoice_id=$1 AND status='Draft'
              AND ($2::numeric + $3::numeric) <= subtotal_amount
            RETURNING invoice_id""", invoice_id, body.insurance_deduction, body.manual_discount, user.staff_id)
        if not row:
            exists = await tx.fetchrow("SELECT status,subtotal_amount FROM invoice WHERE invoice_id=$1", invoice_id)
            if not exists:
                raise HTTPException(404, "Invoice not found")
            if exists["status"] != "Draft":
                raise HTTPException(409, "Only Draft invoices can be finalized")
            raise HTTPException(422, "Deductions and discount cannot exceed the invoice subtotal")
        result = await tx.fetchrow("SELECT * FROM v_invoice_outstanding WHERE invoice_id=$1", invoice_id)
    return _success(dict(result))


@router.get("/invoices/{invoice_id}/payments")
async def invoice_payments(invoice_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, Depends(require_role("Receptionist", "Admin"))], paging: Annotated[dict[str, int], Depends(pagination)]):
    if not await conn.fetchval("SELECT 1 FROM invoice WHERE invoice_id=$1", invoice_id):
        raise HTTPException(404, "Invoice not found")
    rows = await conn.fetch("SELECT payment_id,invoice_id,amount_paid,payment_method,payment_date,processed_by_staff_id,COUNT(*) OVER() AS total FROM payment WHERE invoice_id=$1 ORDER BY payment_date DESC,payment_id DESC LIMIT $2 OFFSET $3", invoice_id, paging["limit"], paging["offset"])
    return _success_list([dict(r) for r in rows], rows[0]["total"] if rows else 0, paging["page"], paging["page_size"])


@router.post("/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
async def create_payment(invoice_id: int, body: PaymentCreate, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], user: Annotated[UserIdentity, RECEPTION]):
    async with with_transaction(staff_id=user.staff_id) as tx:
        locked = await tx.fetchrow("SELECT invoice_id,status FROM invoice WHERE invoice_id=$1 FOR UPDATE", invoice_id)
        if not locked:
            raise HTTPException(404, "Invoice not found")
        inv = await tx.fetchrow("SELECT * FROM v_invoice_outstanding WHERE invoice_id=$1", invoice_id)
        if inv["status"] not in ("Finalized", "Partially Paid"):
            raise HTTPException(409, "Payments can only be recorded for finalized invoices")
        if body.amount_paid > inv["outstanding_amount"]:
            raise HTTPException(422, "Payment exceeds the outstanding balance")
        row = await tx.fetchrow("INSERT INTO payment(invoice_id,amount_paid,payment_method,processed_by_staff_id) VALUES($1,$2,$3,$4) RETURNING payment_id,invoice_id,amount_paid,payment_method,payment_date,processed_by_staff_id", invoice_id, body.amount_paid, body.payment_method, user.staff_id)
        fresh = await tx.fetchrow("SELECT * FROM v_invoice_outstanding WHERE invoice_id=$1", invoice_id)
        new_status = "Paid" if fresh["outstanding_amount"] == 0 else "Partially Paid"
        await tx.execute("UPDATE invoice SET status=$2 WHERE invoice_id=$1", invoice_id, new_status)
    return _success(dict(row))


@router.get("/payments/{payment_id}")
async def get_payment(payment_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, BILLING_READ]):
    row = await conn.fetchrow("SELECT payment_id,invoice_id,amount_paid,payment_method,payment_date,processed_by_staff_id FROM payment WHERE payment_id=$1", payment_id)
    if not row:
        raise HTTPException(404, "Payment not found")
    return _success(dict(row))


@router.get("/insurance-claims")
async def list_claims(conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, BILLING_READ], paging: Annotated[dict[str, int], Depends(pagination)], status_filter: str | None = Query(default=None, alias="status"), branch_id: int | None = Query(default=None, ge=1)):
    rows = await conn.fetch("""SELECT c.*, i.appointment_id, a.branch_id, a.patient_id,
        COUNT(*) OVER() AS total FROM insurance_claim c JOIN invoice i USING(invoice_id)
        JOIN appointment a USING(appointment_id)
        WHERE ($1::text IS NULL OR c.verification_status::text=$1)
          AND ($2::int IS NULL OR a.branch_id=$2)
        ORDER BY c.claim_id DESC LIMIT $3 OFFSET $4""", status_filter, branch_id, paging["limit"], paging["offset"])
    return _success_list([dict(r) for r in rows], rows[0]["total"] if rows else 0, paging["page"], paging["page_size"])


@router.post("/invoices/{invoice_id}/claim", status_code=status.HTTP_201_CREATED)
async def create_claim(invoice_id: int, body: ClaimCreate, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    row = await conn.fetchrow("""INSERT INTO insurance_claim(invoice_id,policy_id,claimed_amount)
        SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM invoice WHERE invoice_id=$1)
        RETURNING claim_id,invoice_id,policy_id,claimed_amount,approved_amount,verification_status,verification_date""", invoice_id, body.policy_id, body.claimed_amount)
    if not row:
        raise HTTPException(404, "Invoice not found")
    return _success(dict(row))


@router.post("/insurance-claims/{claim_id}/verify")
async def verify_claim(claim_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, RECEPTION]):
    # Replace this deterministic local mock with the group's configured insurer mock API adapter.
    async with conn.transaction():
        claim = await conn.fetchrow("SELECT * FROM insurance_claim WHERE claim_id=$1 FOR UPDATE", claim_id)
        if not claim:
            raise HTTPException(404, "Insurance claim not found")
        if claim["verification_status"] != "Pending":
            raise HTTPException(409, "Only Pending claims can be verified")
        mock_approved_amount = claim["claimed_amount"]
        if mock_approved_amount < 0 or mock_approved_amount > claim["claimed_amount"]:
            raise HTTPException(502, "Insurance verification returned an invalid approved amount")
        row = await conn.fetchrow("""UPDATE insurance_claim SET approved_amount=$2,
            verification_status='Approved',verification_date=NOW() WHERE claim_id=$1
            RETURNING claim_id,invoice_id,policy_id,claimed_amount,approved_amount,verification_status,verification_date""", claim_id, mock_approved_amount)
    return _success(dict(row))


@router.get("/insurance-claims/{claim_id}")
async def get_claim(claim_id: int, conn: Annotated[PoolConnectionProxy, Depends(get_conn)], _user: Annotated[UserIdentity, BILLING_READ]):
    row = await conn.fetchrow("""SELECT c.*, i.appointment_id, a.patient_id, a.branch_id
        FROM insurance_claim c JOIN invoice i USING(invoice_id)
        JOIN appointment a USING(appointment_id) WHERE c.claim_id=$1""", claim_id)
    if not row:
        raise HTTPException(404, "Insurance claim not found")
    return _success(dict(row))
