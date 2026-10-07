from asyncpg.exceptions import UniqueViolationError
from asyncpg.pool import PoolConnectionProxy
import json

from app.core.db import get_pool, with_transaction


class DuplicatePatientNIC(Exception):
    def __init__(self, patient_id: int):
        self.patient_id = patient_id
        super().__init__("A patient with this NIC/passport number already exists")


async def patient_exists(conn: PoolConnectionProxy, patient_id: int) -> bool:
    return bool(
        await conn.fetchval(
            "SELECT 1 FROM patient WHERE patient_id = $1", patient_id
        )
    )


async def _patient_id_for_nic(nic_passport_no: str) -> int | None:
    async with get_pool().acquire() as conn:
        return await conn.fetchval(
            "SELECT patient_id FROM patient WHERE nic_passport_no = $1",
            nic_passport_no,
        )


async def list_patients(
    conn: PoolConnectionProxy,
    search: str | None,
    branch_id: int | None,
    offset: int,
    limit: int,
) -> tuple[list[dict], int]:
    total = await conn.fetchval(
        """
        SELECT count(*)
        FROM patient AS p
        WHERE ($1::text IS NULL OR
            p.first_name ILIKE '%' || $1 || '%' OR
            p.last_name ILIKE '%' || $1 || '%' OR
            (p.first_name || ' ' || p.last_name) ILIKE '%' || $1 || '%' OR
            p.nic_passport_no ILIKE '%' || $1 || '%' OR
            EXISTS (
                SELECT 1 FROM patient_phone AS pp
                WHERE pp.patient_id = p.patient_id
                  AND pp.phone_number ILIKE '%' || $1 || '%'
            ))
          AND ($2::int IS NULL OR p.registered_branch_id = $2)
        """,
        search,
        branch_id,
    )
    rows = await conn.fetch(
        """
        SELECT p.patient_id, p.nic_passport_no, p.first_name, p.last_name,
               p.date_of_birth, p.gender::text AS gender, p.address,
               p.registered_branch_id, b.branch_name AS registered_branch,
               p.created_at,
               COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                       'phone_id', pp.phone_id,
                       'phone_number', pp.phone_number,
                       'phone_type', pp.phone_type::text
                   ) ORDER BY pp.phone_id)
                   FROM patient_phone AS pp
                   WHERE pp.patient_id = p.patient_id
               ), '[]'::jsonb) AS phones
        FROM patient AS p
        JOIN branch AS b ON b.branch_id = p.registered_branch_id
        WHERE ($1::text IS NULL OR
            p.first_name ILIKE '%' || $1 || '%' OR
            p.last_name ILIKE '%' || $1 || '%' OR
            (p.first_name || ' ' || p.last_name) ILIKE '%' || $1 || '%' OR
            p.nic_passport_no ILIKE '%' || $1 || '%' OR
            EXISTS (
                SELECT 1 FROM patient_phone AS pp
                WHERE pp.patient_id = p.patient_id
                  AND pp.phone_number ILIKE '%' || $1 || '%'
            ))
          AND ($2::int IS NULL OR p.registered_branch_id = $2)
        ORDER BY p.last_name, p.first_name, p.patient_id
        LIMIT $3 OFFSET $4
        """,
        search,
        branch_id,
        limit,
        offset,
    )
    return [dict(row) for row in rows], total


async def get_patient(conn: PoolConnectionProxy, patient_id: int) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT patient_id, nic_passport_no, first_name, last_name,
               date_of_birth, gender::text AS gender, address,
               registered_branch_id, registered_branch_name AS registered_branch,
               created_at, phones, guardians, insurance_policies AS insurance
        FROM v_patient_profile
        WHERE patient_id = $1
        """,
        patient_id,
    )
    if row is None:
        return None
    patient = dict(row)
    # asyncpg normally decodes JSONB, but support string values from alternate
    # connection codecs while preserving the existing response keys.
    for key in ("phones", "guardians", "insurance"):
        if isinstance(patient[key], str):
            patient[key] = json.loads(patient[key])
    return patient


async def create_patient(fields: dict, staff_id: int) -> dict:
    try:
        async with with_transaction(staff_id=staff_id) as conn:
            duplicate_id = await conn.fetchval(
                "SELECT patient_id FROM patient WHERE nic_passport_no = $1",
                fields["nic_passport_no"],
            )
            if duplicate_id is not None:
                raise DuplicatePatientNIC(duplicate_id)
            row = await conn.fetchrow(
                """
                INSERT INTO patient (
                    nic_passport_no, first_name, last_name, date_of_birth,
                    gender, address, registered_branch_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING patient_id, nic_passport_no, first_name, last_name,
                          date_of_birth, gender::text AS gender, address,
                          registered_branch_id, created_at
                """,
                fields["nic_passport_no"],
                fields["first_name"],
                fields["last_name"],
                fields["date_of_birth"],
                fields["gender"],
                fields.get("address"),
                fields["registered_branch_id"],
            )
        return dict(row)
    except DuplicatePatientNIC:
        raise
    except UniqueViolationError:
        duplicate_id = await _patient_id_for_nic(fields["nic_passport_no"])
        if duplicate_id is not None:
            raise DuplicatePatientNIC(duplicate_id) from None
        raise


async def update_patient(
    patient_id: int, fields: dict, staff_id: int
) -> dict | None:
    allowed_columns = {
        "nic_passport_no": "nic_passport_no",
        "first_name": "first_name",
        "last_name": "last_name",
        "date_of_birth": "date_of_birth",
        "gender": "gender",
        "address": "address",
    }
    try:
        async with with_transaction(staff_id=staff_id) as conn:
            if "nic_passport_no" in fields:
                duplicate_id = await conn.fetchval(
                    """
                    SELECT patient_id FROM patient
                    WHERE nic_passport_no = $1 AND patient_id <> $2
                    """,
                    fields["nic_passport_no"],
                    patient_id,
                )
                if duplicate_id is not None:
                    raise DuplicatePatientNIC(duplicate_id)

            assignments = []
            values = []
            for key, value in fields.items():
                assignments.append(f"{allowed_columns[key]} = ${len(values) + 1}")
                values.append(value)
            values.append(patient_id)
            row = await conn.fetchrow(
                "UPDATE patient SET " + ", ".join(assignments)
                + f" WHERE patient_id = ${len(values)}"
                + " RETURNING patient_id, nic_passport_no, first_name, last_name,"
                + " date_of_birth, gender::text AS gender, address,"
                + " registered_branch_id, created_at",
                *values,
            )
        return dict(row) if row else None
    except DuplicatePatientNIC:
        raise
    except UniqueViolationError:
        nic = fields.get("nic_passport_no")
        if nic is not None:
            duplicate_id = await _patient_id_for_nic(nic)
            if duplicate_id is not None and duplicate_id != patient_id:
                raise DuplicatePatientNIC(duplicate_id) from None
        raise


async def list_patient_phones(
    conn: PoolConnectionProxy, patient_id: int, offset: int, limit: int
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT phone_id, patient_id, phone_number, phone_type::text AS phone_type
        FROM patient_phone WHERE patient_id = $1
        ORDER BY phone_id LIMIT $2 OFFSET $3
        """,
        patient_id,
        limit,
        offset,
    )
    return [dict(row) for row in rows]


async def count_patient_phones(conn: PoolConnectionProxy, patient_id: int) -> int:
    return await conn.fetchval(
        "SELECT count(*) FROM patient_phone WHERE patient_id = $1", patient_id
    )


async def add_patient_phone(
    conn: PoolConnectionProxy, patient_id: int, fields: dict
) -> dict | None:
    exists = await conn.fetchval(
        "SELECT 1 FROM patient WHERE patient_id = $1", patient_id
    )
    if not exists:
        return None
    row = await conn.fetchrow(
        """
        INSERT INTO patient_phone (patient_id, phone_number, phone_type)
        VALUES ($1, $2, $3)
        RETURNING phone_id, patient_id, phone_number, phone_type::text AS phone_type
        """,
        patient_id,
        fields["phone_number"],
        fields["phone_type"],
    )
    return dict(row)


async def remove_patient_phone(
    conn: PoolConnectionProxy, patient_id: int, phone_id: int
) -> bool:
    row = await conn.fetchrow(
        """
        DELETE FROM patient_phone
        WHERE patient_id = $1 AND phone_id = $2
        RETURNING phone_id
        """,
        patient_id,
        phone_id,
    )
    return row is not None


async def list_patient_guardians(
    conn: PoolConnectionProxy, patient_id: int, offset: int, limit: int
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT g.guardian_id, g.first_name, g.last_name, g.nic,
               pg.relationship
        FROM patient_guardian AS pg
        JOIN guardian AS g ON g.guardian_id = pg.guardian_id
        WHERE pg.patient_id = $1
        ORDER BY g.last_name, g.first_name, g.guardian_id
        LIMIT $2 OFFSET $3
        """,
        patient_id,
        limit,
        offset,
    )
    return [dict(row) for row in rows]


async def count_patient_guardians(conn: PoolConnectionProxy, patient_id: int) -> int:
    return await conn.fetchval(
        "SELECT count(*) FROM patient_guardian WHERE patient_id = $1", patient_id
    )


async def link_patient_guardian(
    conn: PoolConnectionProxy, patient_id: int, fields: dict
) -> dict | None:
    async with conn.transaction():
        patient_exists = await conn.fetchval(
            "SELECT 1 FROM patient WHERE patient_id = $1", patient_id
        )
        if not patient_exists:
            return None
        if fields.get("new_guardian") is not None:
            new_guardian = fields["new_guardian"]
            guardian_row = await conn.fetchrow(
                """
                INSERT INTO guardian (first_name, last_name, nic, address)
                VALUES ($1, $2, $3, $4)
                RETURNING guardian_id
                """,
                new_guardian["first_name"],
                new_guardian["last_name"],
                new_guardian.get("nic"),
                new_guardian.get("address"),
            )
            guardian_id = guardian_row["guardian_id"]
        else:
            guardian_id = fields["guardian_id"]
            guardian_exists = await conn.fetchval(
                "SELECT 1 FROM guardian WHERE guardian_id = $1", guardian_id
            )
            if not guardian_exists:
                return None

        row = await conn.fetchrow(
            """
            INSERT INTO patient_guardian (patient_id, guardian_id, relationship)
            VALUES ($1, $2, $3)
            ON CONFLICT (patient_id, guardian_id) DO NOTHING
            RETURNING patient_id, guardian_id, relationship
            """,
            patient_id,
            guardian_id,
            fields["relationship"],
        )
        return dict(row) if row else {"already_linked": True}


async def unlink_patient_guardian(
    conn: PoolConnectionProxy, patient_id: int, guardian_id: int
) -> bool:
    row = await conn.fetchrow(
        """
        DELETE FROM patient_guardian
        WHERE patient_id = $1 AND guardian_id = $2
        RETURNING guardian_id
        """,
        patient_id,
        guardian_id,
    )
    return row is not None


async def list_patient_insurance(
    conn: PoolConnectionProxy, patient_id: int, offset: int, limit: int
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT policy_id, patient_id, provider_name, coverage_level,
               status::text AS status
        FROM insurance WHERE patient_id = $1
        ORDER BY policy_id LIMIT $2 OFFSET $3
        """,
        patient_id,
        limit,
        offset,
    )
    return [dict(row) for row in rows]


async def count_patient_insurance(conn: PoolConnectionProxy, patient_id: int) -> int:
    return await conn.fetchval(
        "SELECT count(*) FROM insurance WHERE patient_id = $1", patient_id
    )


async def add_patient_insurance(
    conn: PoolConnectionProxy, patient_id: int, fields: dict
) -> dict | None:
    exists = await conn.fetchval(
        "SELECT 1 FROM patient WHERE patient_id = $1", patient_id
    )
    if not exists:
        return None
    row = await conn.fetchrow(
        """
        INSERT INTO insurance (policy_id, patient_id, provider_name, coverage_level, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING policy_id, patient_id, provider_name, coverage_level,
                  status::text AS status
        """,
        fields["policy_id"],
        patient_id,
        fields["provider_name"],
        fields["coverage_level"],
        fields["status"],
    )
    return dict(row)


async def update_patient_insurance(
    conn: PoolConnectionProxy, patient_id: int, policy_id: str, fields: dict
) -> dict | None:
    columns = {"status": "status", "coverage_level": "coverage_level"}
    assignments = []
    values = []
    for key, value in fields.items():
        assignments.append(f"{columns[key]} = ${len(values) + 1}")
        values.append(value)
    values.extend((patient_id, policy_id))
    row = await conn.fetchrow(
        "UPDATE insurance SET " + ", ".join(assignments)
        + f" WHERE patient_id = ${len(values) - 1} AND policy_id = ${len(values)}"
        + " RETURNING policy_id, patient_id, provider_name, coverage_level,"
        + " status::text AS status",
        *values,
    )
    return dict(row) if row else None


async def list_patient_appointments(
    conn: PoolConnectionProxy,
    patient_id: int,
    offset: int,
    limit: int,
    branch_id: int | None = None,
) -> tuple[list[dict], int]:
    total = await conn.fetchval(
        "SELECT count(*) FROM appointment "
        "WHERE patient_id = $1 AND ($2::int IS NULL OR branch_id = $2)",
        patient_id,
        branch_id,
    )
    rows = await conn.fetch(
        """
        SELECT a.appointment_id, a.patient_id, a.doctor_staff_id,
               concat_ws(' ', s.first_name, s.last_name) AS doctor_name,
               a.branch_id, b.branch_name, a.appointment_date,
               a.appointment_time, a.status::text AS status, a.is_walk_in,
               a.cancel_reschedule_reason, a.created_at
        FROM appointment AS a
        JOIN staff AS s ON s.staff_id = a.doctor_staff_id
        JOIN branch AS b ON b.branch_id = a.branch_id
        WHERE a.patient_id = $1
          AND ($2::int IS NULL OR a.branch_id = $2)
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT $3 OFFSET $4
        """,
        patient_id,
        branch_id,
        limit,
        offset,
    )
    return [dict(row) for row in rows], total
