from datetime import date, datetime, time, timedelta

from asyncpg.pool import PoolConnectionProxy

from app.domains.appointment.schemas import AppointmentCreate

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
) -> tuple[list[dict], int]:
    filters: list[str] = []
    values: list[object] = []

    for column, value in (
        ("branch_id", branch_id),
        ("doctor_staff_id", doctor_id),
        ("appointment_date", appointment_date),
        ("status", status),
        ("patient_id", patient_id),
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
    conn: PoolConnectionProxy, appointment_id: int
) -> dict | None:
    row = await conn.fetchrow(
        "SELECT * FROM v_appointment_detail WHERE appointment_id = $1",
        appointment_id,
    )
    return dict(row) if row else None


async def create_appointment(
    conn: PoolConnectionProxy,
    body: AppointmentCreate,
    booked_by_staff_id: int,
) -> dict:
    row = await conn.fetchrow(
        "INSERT INTO appointment ("
        "patient_id, doctor_staff_id, branch_id, booked_by_staff_id, "
        "appointment_date, appointment_time, is_walk_in"
        ") VALUES ($1, $2, $3, $4, $5, $6, $7) "
        "RETURNING appointment_id",
        body.patient_id,
        body.doctor_staff_id,
        body.branch_id,
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
    conn: PoolConnectionProxy, appointment_id: int
) -> dict | None:
    row = await conn.fetchrow(
        "UPDATE appointment SET status = 'Completed' "
        "WHERE appointment_id = $1 AND status = 'Scheduled' "
        "RETURNING appointment_id",
        appointment_id,
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
        "AND a.status != 'Cancelled' "
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