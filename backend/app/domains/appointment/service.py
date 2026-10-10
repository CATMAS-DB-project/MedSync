from datetime import date, datetime, time, timedelta

from asyncpg.pool import PoolConnectionProxy

from app.domains.appointment.schemas import AppointmentCreate, AppointmentReschedule

DETAIL_COLUMNS = "*"


async def list_appointments(
    conn: PoolConnectionProxy,
    *,
    branch_id: int | None,
    doctor_id: int | None,
    appointment_date: date | None,
    status: str | None,
    patient_id: int | None,
    limit: int,
    offset: int,
    doctor_scope: int | None = None,
) -> tuple[list[dict], int]:
    filters: list[str] = []
    values: list[object] = []

    for column, value in (
        ("branch_id", branch_id),
        ("doctor_staff_id", doctor_id),
        ("appointment_date", appointment_date),
        ("status", status),
        ("patient_id", patient_id),
        ("doctor_staff_id", doctor_scope),
    ):
        if value is not None:
            values.append(value)
            filters.append(f"{column} = ${len(values)}")

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    total = await conn.fetchval(
        f"SELECT COUNT(*) FROM v_appointment_detail {where_clause}",
        *values,
    )

    limit_position = len(values) + 1
    offset_position = len(values) + 2
    rows = await conn.fetch(
        f"SELECT {DETAIL_COLUMNS} FROM v_appointment_detail "
        f"{where_clause} "
        "ORDER BY appointment_date DESC, appointment_time DESC, appointment_id DESC "
        f"LIMIT ${limit_position} OFFSET ${offset_position}",
        *values,
        limit,
        offset,
    )
    return [dict(row) for row in rows], int(total or 0)


async def get_appointment(
    conn: PoolConnectionProxy, appointment_id: int, branch_id: int | None = None,
    doctor_scope: int | None = None,
) -> dict | None:
    row = await conn.fetchrow(
        "SELECT * FROM v_appointment_detail "
        "WHERE appointment_id = $1 AND ($2::int IS NULL OR branch_id = $2) "
        "AND ($3::int IS NULL OR doctor_staff_id = $3)",
        appointment_id,
        branch_id,
        doctor_scope,
    )
    return dict(row) if row else None


async def create_appointment(
    conn: PoolConnectionProxy,
    body: AppointmentCreate,
    booked_by_staff_id: int,
    branch_id: int | None = None,
) -> dict:
    effective_branch = body.branch_id if branch_id is None else branch_id
    doctor_branch = await conn.fetchval(
        "SELECT s.branch_id FROM doctor d JOIN staff s ON s.staff_id = d.staff_id "
        "WHERE d.staff_id = $1", body.doctor_staff_id
    )
    patient_branch = await conn.fetchval(
        "SELECT registered_branch_id FROM patient WHERE patient_id = $1",
        body.patient_id,
    )
    if doctor_branch is None:
        raise ValueError("Doctor not found")
    if patient_branch is None:
        raise ValueError("Patient not found")
    # Patients may receive emergency or walk-in care at another branch.  The
    # appointment branch must still be the doctor's branch, but it need not be
    # the patient's registered branch.
    if doctor_branch != effective_branch:
        raise ValueError("Doctor must belong to the appointment branch")
    row = await conn.fetchrow(
        "INSERT INTO appointment ("
        "patient_id, doctor_staff_id, branch_id, booked_by_staff_id, "
        "appointment_date, appointment_time, is_walk_in"
        ") VALUES ($1, $2, $3, $4, $5, $6, $7) "
        "RETURNING appointment_id",
        body.patient_id,
        body.doctor_staff_id,
        effective_branch,
        booked_by_staff_id,
        body.appointment_date,
        body.appointment_time,
        body.is_walk_in,
    )
    appointment = await get_appointment(conn, row["appointment_id"])
    assert appointment is not None
    return appointment


async def cancel_appointment(
    conn: PoolConnectionProxy, appointment_id: int, reason: str
) -> dict | None:
    row = await conn.fetchrow(
        "UPDATE appointment "
        "SET status = 'Cancelled', cancel_reschedule_reason = $2 "
        "WHERE appointment_id = $1 AND status = 'Scheduled' "
        "RETURNING appointment_id",
        appointment_id,
        reason,
    )
    if not row:
        return None
    return await get_appointment(conn, row["appointment_id"])


async def complete_appointment(
    conn: PoolConnectionProxy, appointment_id: int, doctor_id: int | None = None
) -> dict | None:
    row = await conn.fetchrow(
        "UPDATE appointment SET status = 'Completed' "
        "WHERE appointment_id = $1 AND status = 'Scheduled' "
        "AND ($2::int IS NULL OR doctor_staff_id = $2) "
        "RETURNING appointment_id",
        appointment_id,
        doctor_id,
    )
    if not row:
        return None
    return await get_appointment(conn, row["appointment_id"])


async def list_availability(
    conn: PoolConnectionProxy,
    *,
    doctor_id: int,
    appointment_date: date,
    opening_time: time,
    closing_time: time,
    slot_minutes: int,
) -> list[dict] | None:
    rows = await conn.fetch(
        "SELECT d.staff_id, a.appointment_time "
        "FROM doctor d "
        "LEFT JOIN appointment a "
        "ON a.doctor_staff_id = d.staff_id "
        "AND a.appointment_date = $2 "
        "AND a.status NOT IN ('Cancelled', 'Re-Scheduled') "
        "WHERE d.staff_id = $1 "
        "ORDER BY a.appointment_time",
        doctor_id,
        appointment_date,
    )
    if not rows:
        return None

    booked_times = {
        row["appointment_time"]
        for row in rows
        if row["appointment_time"] is not None
    }
    current = datetime.combine(appointment_date, opening_time)
    closing = datetime.combine(appointment_date, closing_time)
    interval = timedelta(minutes=slot_minutes)
    availability: list[dict] = []

    while current < closing:
        slot = current.time()
        availability.append(
            {
                "time": slot.strftime("%H:%M"),
                "available": slot not in booked_times,
            }
        )
        current += interval

    return availability


async def reschedule_appointment(
    conn: PoolConnectionProxy,
    appointment_id: int,
    body: AppointmentReschedule,
    staff_id: int,
    branch_id: int | None = None,
) -> dict | None:
    """
    Executes the Transition Chain reschedule:
    1. Locks the existing appointment row.
    2. Validates status is 'Scheduled' and doctor belongs to branch.
    3. Marks the existing row as 'Re-Scheduled'.
    4. Inserts a new appointment row with 'Scheduled' status.
    5. Returns the newly created appointment detail view row.
    """
    old = await conn.fetchrow(
        "SELECT appointment_id, patient_id, doctor_staff_id, branch_id, "
        "status, is_walk_in, consultation_notes "
        "FROM appointment "
        "WHERE appointment_id = $1 "
        "FOR UPDATE",
        appointment_id,
    )
    if not old:
        return None

    if old["status"] != "Scheduled":
        raise ValueError(
            f"Cannot reschedule appointment with status '{old['status']}'. "
            "Only 'Scheduled' appointments can be rescheduled."
        )

    doctor_branch = await conn.fetchval(
        "SELECT s.branch_id FROM doctor d JOIN staff s ON s.staff_id = d.staff_id "
        "WHERE d.staff_id = $1",
        old["doctor_staff_id"],
    )
    effective_branch = branch_id if branch_id is not None else old["branch_id"]
    if doctor_branch is None:
        raise ValueError("Doctor not found")
    if doctor_branch != effective_branch:
        raise ValueError("Doctor must belong to the appointment branch")

    user_reason = body.reason.strip() if body.reason and body.reason.strip() else "Patient requested reschedule"

    # 1. Mark existing appointment as Re-Scheduled
    old_reason = f"Rescheduled to {body.appointment_date} {body.appointment_time.strftime('%H:%M')}: {user_reason}"
    await conn.execute(
        "UPDATE appointment "
        "SET status = 'Re-Scheduled', "
        "    cancel_reschedule_reason = $2 "
        "WHERE appointment_id = $1",
        appointment_id,
        old_reason,
    )

    # 2. Insert new appointment row
    new_reason = f"Rescheduled from visit #{appointment_id}: {user_reason}"
    new_row = await conn.fetchrow(
        "INSERT INTO appointment ("
        "patient_id, doctor_staff_id, branch_id, booked_by_staff_id, "
        "appointment_date, appointment_time, is_walk_in, "
        "status, cancel_reschedule_reason, consultation_notes"
        ") VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled', $8, $9) "
        "RETURNING appointment_id",
        old["patient_id"],
        old["doctor_staff_id"],
        effective_branch,
        staff_id,
        body.appointment_date,
        body.appointment_time,
        old["is_walk_in"],
        new_reason,
        old["consultation_notes"],
    )

    new_appointment = await get_appointment(conn, new_row["appointment_id"])
    assert new_appointment is not None
    new_appointment["previous_appointment_id"] = appointment_id
    return new_appointment


async def get_reschedule_history(
    conn: PoolConnectionProxy, appointment_id: int
) -> list[dict]:
    rows = await conn.fetch(
        "SELECT a.appointment_id, a.appointment_date, a.appointment_time, "
        "a.status, a.cancel_reschedule_reason, a.created_at, "
        "s.first_name || ' ' || s.last_name AS booked_by_name "
        "FROM appointment a "
        "JOIN staff s ON s.staff_id = a.booked_by_staff_id "
        "WHERE a.cancel_reschedule_reason ILIKE '%' || $1::text || '%' "
        "   OR a.appointment_id = $1 "
        "ORDER BY a.created_at ASC",
        appointment_id,
    )
    return [dict(r) for r in rows]