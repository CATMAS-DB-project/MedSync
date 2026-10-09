from datetime import date

from asyncpg.pool import PoolConnectionProxy


def _date_filters(
    *,
    branch_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    branch_column: str = "a.branch_id",
    date_column: str = "a.appointment_date",
) -> tuple[str, list[object]]:
    filters: list[str] = []
    values: list[object] = []
    for column, value, operator in (
        (branch_column, branch_id, "="),
        (date_column, from_date, ">="),
        (date_column, to_date, "<="),
    ):
        if value is not None:
            values.append(value)
            filters.append(f"{column} {operator} ${len(values)}")
    return (
        f"WHERE {' AND '.join(filters)}" if filters else "",
        values,
    )


async def appointments_summary(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict]:
    where, values = _date_filters(
        branch_id=branch_id, from_date=from_date, to_date=to_date
    )
    rows = await conn.fetch(
        "SELECT a.appointment_date, "
        "COUNT(*) AS total_count, "
        "COUNT(*) FILTER (WHERE a.status = 'Scheduled') AS scheduled_count, "
        "COUNT(*) FILTER (WHERE a.status = 'Completed') AS completed_count, "
        "COUNT(*) FILTER (WHERE a.status = 'Cancelled') AS cancelled_count "
        f"FROM appointment a {where} "
        "GROUP BY a.appointment_date ORDER BY a.appointment_date",
        *values,
    )
    return [dict(row) for row in rows]


async def doctor_revenue(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict]:
    where, values = _date_filters(
        branch_id=branch_id,
        from_date=from_date,
        to_date=to_date,
        branch_column="r.branch_id",
        date_column="r.appointment_date",
    )
    rows = await conn.fetch(
        "WITH revenue AS ("
        "SELECT r.branch_id, r.branch_name, r.doctor_staff_id, "
        "r.doctor_name, COUNT(*) AS appointment_count, "
        "SUM(r.payable_amount) AS revenue "
        f"FROM v_doctor_revenue r {where} "
        "GROUP BY r.branch_id, r.branch_name, r.doctor_staff_id, r.doctor_name"
        ") "
        "SELECT revenue.*, RANK() OVER ("
        "PARTITION BY branch_id ORDER BY revenue DESC"
        ") AS revenue_rank "
        "FROM revenue ORDER BY branch_id, revenue_rank, doctor_name",
        *values,
    )
    return [dict(row) for row in rows]


async def outstanding_balances(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    patient_id: int | None = None,
) -> list[dict]:
    filters = ["o.outstanding_amount > 0"]
    values: list[object] = []
    if branch_id is not None:
        values.append(branch_id)
        filters.append(f"a.branch_id = ${len(values)}")
    if patient_id is not None:
        values.append(patient_id)
        filters.append(f"a.patient_id = ${len(values)}")
    rows = await conn.fetch(
        "SELECT o.invoice_id, o.appointment_id, a.branch_id, b.branch_name, "
        "p.patient_id, p.first_name || ' ' || p.last_name AS patient_name, "
        "o.payable_amount, o.amount_paid, o.outstanding_amount "
        "FROM v_invoice_outstanding o "
        "JOIN appointment a ON a.appointment_id = o.appointment_id "
        "JOIN patient p ON p.patient_id = a.patient_id "
        "JOIN branch b ON b.branch_id = a.branch_id "
        f"WHERE {' AND '.join(filters)} "
        "ORDER BY o.outstanding_amount DESC, patient_name",
        *values,
    )
    return [dict(row) for row in rows]


async def treatment_frequency(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    category: str | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict]:
    filters = ["a.status = 'Completed'"]
    values: list[object] = []
    if branch_id is not None:
        values.append(branch_id)
        filters.append("a.branch_id = $1")
    for column, value, operator in (
        ("tc.category", category, "="),
        ("a.appointment_date", from_date, ">="),
        ("a.appointment_date", to_date, "<="),
    ):
        if value is not None:
            values.append(value)
            filters.append(f"{column} {operator} ${len(values)}")
    rows = await conn.fetch(
        "SELECT at.service_code, tc.treatment_name, tc.category, "
        "COUNT(*) AS treatment_count "
        "FROM appointment_treatment at "
        "JOIN appointment a ON a.appointment_id = at.appointment_id "
        "JOIN treatment_catalogue tc ON tc.service_code = at.service_code "
        f"WHERE {' AND '.join(filters)} "
        "GROUP BY at.service_code, tc.treatment_name, tc.category "
        "ORDER BY treatment_count DESC, tc.treatment_name",
        *values,
    )
    return [dict(row) for row in rows]


async def insurance_vs_outofpocket(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    from_date: date | None,
    to_date: date | None,
) -> dict:
    where, values = _date_filters(
        branch_id=branch_id, from_date=from_date, to_date=to_date
    )
    row = await conn.fetchrow(
        "SELECT COUNT(*) AS invoice_count, "
        "COALESCE(SUM(i.subtotal_amount), 0) AS subtotal_amount, "
        "COALESCE(SUM(i.insurance_deduction), 0) AS insurance_amount, "
        "COALESCE(SUM(i.subtotal_amount - i.insurance_deduction "
        "- i.manual_discount), 0) AS out_of_pocket_amount "
        "FROM invoice i JOIN appointment a "
        "ON a.appointment_id = i.appointment_id "
        f"{where} AND a.status = 'Completed'"
        if where
        else "FROM invoice i JOIN appointment a "
        "ON a.appointment_id = i.appointment_id "
        "WHERE a.status = 'Completed'",
        *values,
    )
    return dict(row)
