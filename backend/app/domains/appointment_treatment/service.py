from asyncpg.pool import PoolConnectionProxy

from app.domains.appointment.service import get_appointment
from app.domains.appointment_treatment.schemas import (
    ConsultationNotesUpdate,
    TreatmentAmendCreate,
    TreatmentLogCreate,
)

TREATMENT_COLUMNS = (
    "at.appointment_treatment_id, at.appointment_id, at.service_code, "
    "tc.treatment_name, at.price_at_time, at.is_amended, "
    "at.amendment_reason, at.original_record_id, at.recorded_at"
)


async def list_treatments(
    conn: PoolConnectionProxy, appointment_id: int
) -> list[dict] | None:
    appointment_exists = await conn.fetchval(
        "SELECT 1 FROM appointment WHERE appointment_id = $1", appointment_id
    )
    if not appointment_exists:
        return None

    rows = await conn.fetch(
        f"SELECT {TREATMENT_COLUMNS} "
        "FROM appointment_treatment at "
        "JOIN treatment_catalogue tc ON tc.service_code = at.service_code "
        "WHERE at.appointment_id = $1 "
        "ORDER BY at.recorded_at, at.appointment_treatment_id",
        appointment_id,
    )
    return [dict(row) for row in rows]


async def _catalogue_price(conn: PoolConnectionProxy, service_code: str):
    return await conn.fetchval(
        "SELECT unit_price FROM treatment_catalogue WHERE service_code = $1",
        service_code,
    )


async def create_treatment(
    conn: PoolConnectionProxy,
    appointment_id: int,
    body: TreatmentLogCreate,
) -> dict | None:
    appointment_exists = await conn.fetchval(
        "SELECT 1 FROM appointment WHERE appointment_id = $1", appointment_id
    )
    if not appointment_exists:
        return None

    price = await _catalogue_price(conn, body.service_code)
    if price is None:
        return None

    row = await conn.fetchrow(
        "INSERT INTO appointment_treatment "
        "(appointment_id, service_code, price_at_time) "
        "VALUES ($1, $2, $3) "
        "RETURNING appointment_treatment_id",
        appointment_id,
        body.service_code,
        price,
    )
    return await get_treatment(conn, row["appointment_treatment_id"])


async def get_treatment(
    conn: PoolConnectionProxy, appointment_treatment_id: int
) -> dict | None:
    row = await conn.fetchrow(
        f"SELECT {TREATMENT_COLUMNS} "
        "FROM appointment_treatment at "
        "JOIN treatment_catalogue tc ON tc.service_code = at.service_code "
        "WHERE at.appointment_treatment_id = $1",
        appointment_treatment_id,
    )
    return dict(row) if row else None


async def amend_treatment(
    conn: PoolConnectionProxy,
    appointment_treatment_id: int,
    body: TreatmentAmendCreate,
) -> dict | None:
    original = await conn.fetchrow(
        "SELECT appointment_id FROM appointment_treatment "
        "WHERE appointment_treatment_id = $1",
        appointment_treatment_id,
    )
    if original is None:
        return None

    price = await _catalogue_price(conn, body.service_code)
    if price is None:
        return None

    row = await conn.fetchrow(
        "INSERT INTO appointment_treatment "
        "(appointment_id, service_code, price_at_time, is_amended, "
        "amendment_reason, original_record_id) "
        "VALUES ($1, $2, $3, TRUE, $4, $5) "
        "RETURNING appointment_treatment_id",
        original["appointment_id"],
        body.service_code,
        price,
        body.amendment_reason,
        appointment_treatment_id,
    )
    return await get_treatment(conn, row["appointment_treatment_id"])


async def update_notes(
    conn: PoolConnectionProxy,
    appointment_id: int,
    body: ConsultationNotesUpdate,
) -> dict | None:
    row = await conn.fetchrow(
        "UPDATE appointment SET consultation_notes = $2 "
        "WHERE appointment_id = $1 "
        "RETURNING appointment_id",
        appointment_id,
        body.notes,
    )
    if row is None:
        return None
    return await get_appointment(conn, row["appointment_id"])
