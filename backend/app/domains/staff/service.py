from asyncpg.pool import PoolConnectionProxy

ALLOWED_UPDATE_FIELDS = {
    "first_name",
    "last_name",
    "address",
    "branch_id",
    "job_title",
    "employment_status",
    "hire_date",
}


async def list_staff(
    conn: PoolConnectionProxy,
    offset: int,
    limit: int,
    branch_id: int | None,
    job_title: str | None,
    employment_status: str | None,
    search: str | None,
) -> tuple[list[dict], int]:
    where = ["1=1"]
    args: list[object] = []

    if branch_id is not None:
        args.append(branch_id)
        where.append(f"s.branch_id = ${len(args)}")
    if job_title:
        args.append(job_title)
        where.append(f"s.job_title = ${len(args)}")
    if employment_status:
        args.append(employment_status)
        where.append(f"s.employment_status = ${len(args)}")
    if search:
        escaped = (
            search.lower()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        args.append(f"%{escaped}%")
        idx = len(args)
        where.append(
            f"(LOWER(s.first_name) LIKE ${idx} ESCAPE '\\' "
            f"OR LOWER(s.last_name) LIKE ${idx} ESCAPE '\\' "
            f"OR LOWER(s.nic) LIKE ${idx} ESCAPE '\\')"
        )

    where_sql = " AND ".join(where)
    total = await conn.fetchval(
        f"SELECT COUNT(*) FROM staff s WHERE {where_sql}",
        *args,
    )

    args.extend([limit, offset])
    rows = await conn.fetch(
        f"""
        SELECT s.staff_id, s.nic, s.first_name, s.last_name, s.date_of_birth,
               s.gender, s.address, s.branch_id, b.branch_name,
               s.job_title, s.employment_status, s.hire_date, s.created_at
        FROM staff s
        JOIN branch b ON b.branch_id = s.branch_id
        WHERE {where_sql}
        ORDER BY s.staff_id
        LIMIT ${len(args) - 1} OFFSET ${len(args)}
        """,
        *args,
    )
    return [dict(row) for row in rows], total


async def get_staff(
    conn: PoolConnectionProxy, staff_id: int
) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT s.staff_id, s.nic, s.first_name, s.last_name, s.date_of_birth,
               s.gender, s.address, s.branch_id, b.branch_name,
               s.job_title, s.employment_status, s.hire_date, s.created_at,
               (d.staff_id IS NOT NULL) AS is_doctor,
               (ua.staff_id IS NOT NULL) AS has_account,
               COALESCE(
                   (SELECT jsonb_agg(
                       jsonb_build_object(
                           'phone_id', sp.phone_id,
                           'phone_number', sp.phone_number,
                           'phone_type', sp.phone_type
                       ) ORDER BY sp.phone_id
                   )
                    FROM staff_phone sp
                    WHERE sp.staff_id = s.staff_id),
                   '[]'::jsonb
               ) AS phones
        FROM staff s
        JOIN branch b ON b.branch_id = s.branch_id
        LEFT JOIN doctor d ON d.staff_id = s.staff_id
        LEFT JOIN user_account ua ON ua.staff_id = s.staff_id
        WHERE s.staff_id = $1
        """,
        staff_id,
    )
    return dict(row) if row else None


async def create_staff(
    conn: PoolConnectionProxy, data: dict
) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO staff (nic, first_name, last_name, date_of_birth, gender,
                           address, branch_id, job_title, employment_status,
                           hire_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING staff_id
        """,
        data["nic"],
        data["first_name"],
        data["last_name"],
        data["date_of_birth"],
        data["gender"],
        data.get("address"),
        data["branch_id"],
        data["job_title"],
        data["employment_status"],
        data["hire_date"],
    )
    result = await get_staff(conn, row["staff_id"])
    if result is None:
        raise RuntimeError("Staff row disappeared right after INSERT")
    return result


async def update_staff(
    conn: PoolConnectionProxy, staff_id: int, data: dict
) -> dict | None:
    unknown = set(data) - ALLOWED_UPDATE_FIELDS
    if unknown:
        raise ValueError(f"Unknown update fields: {sorted(unknown)}")

    if not data:
        return await get_staff(conn, staff_id)

    fields: list[str] = []
    values: list[object] = []
    for index, (field, value) in enumerate(data.items(), start=1):
        fields.append(f"{field} = ${index}")
        values.append(value)

    values.append(staff_id)
    result = await conn.fetchval(
        f"UPDATE staff SET {', '.join(fields)} "
        f"WHERE staff_id = ${len(values)} RETURNING staff_id",
        *values,
    )
    if result is None:
        return None
    return await get_staff(conn, staff_id)


async def list_phones(
    conn: PoolConnectionProxy, staff_id: int
) -> list[dict]:
    rows = await conn.fetch(
        "SELECT phone_id, phone_number, phone_type "
        "FROM staff_phone WHERE staff_id = $1 ORDER BY phone_id",
        staff_id,
    )
    return [dict(r) for r in rows]


async def add_phone(
    conn: PoolConnectionProxy, staff_id: int, data: dict
) -> dict:
    row = await conn.fetchrow(
        "INSERT INTO staff_phone (staff_id, phone_number, phone_type) "
        "VALUES ($1, $2, $3) "
        "RETURNING phone_id, phone_number, phone_type",
        staff_id, data["phone_number"], data["phone_type"],
    )
    return dict(row)


async def delete_phone(
    conn: PoolConnectionProxy, staff_id: int, phone_id: int
) -> bool:
    result = await conn.execute(
        "DELETE FROM staff_phone WHERE staff_id = $1 AND phone_id = $2",
        staff_id, phone_id,
    )
    return result.endswith("1")


async def promote_to_doctor(
    conn: PoolConnectionProxy, staff_id: int, data: dict
) -> dict | None:
    await conn.execute(
        """
        INSERT INTO doctor (staff_id, license_no, years_of_experience,
                            consultation_fee, qualifications)
        VALUES ($1, $2, $3, $4, $5)
        """,
        staff_id,
        data["license_no"],
        data["years_of_experience"],
        data["consultation_fee"],
        data.get("qualifications"),
    )
    return await get_doctor(conn, staff_id)


async def get_doctor(
    conn: PoolConnectionProxy, staff_id: int
) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT d.staff_id,
               s.first_name, s.last_name,
               s.first_name || ' ' || s.last_name AS doctor_name,
               s.branch_id, b.branch_name,
               d.license_no, d.years_of_experience,
               d.consultation_fee, d.qualifications,
               COALESCE(
                   (SELECT jsonb_agg(
                       jsonb_build_object(
                           'specialty_id',   sp.specialty_id,
                           'specialty_name', sp.specialty_name
                       ) ORDER BY sp.specialty_name
                   )
                    FROM doctor_specialty ds
                    JOIN specialty sp ON sp.specialty_id = ds.specialty_id
                    WHERE ds.staff_id = d.staff_id),
                   '[]'::jsonb
               ) AS specialties
        FROM doctor d
        JOIN staff s ON s.staff_id = d.staff_id
        JOIN branch b ON b.branch_id = s.branch_id
        WHERE d.staff_id = $1
        """,
        staff_id,
    )
    return dict(row) if row else None


async def link_specialty(
    conn: PoolConnectionProxy, staff_id: int, specialty_id: int
) -> None:
    await conn.execute(
        "INSERT INTO doctor_specialty (staff_id, specialty_id) "
        "VALUES ($1, $2) ON CONFLICT DO NOTHING",
        staff_id, specialty_id,
    )


async def unlink_specialty(
    conn: PoolConnectionProxy, staff_id: int, specialty_id: int
) -> bool:
    result = await conn.execute(
        "DELETE FROM doctor_specialty "
        "WHERE staff_id = $1 AND specialty_id = $2",
        staff_id, specialty_id,
    )
    return result.endswith("1")


async def list_doctors(
    conn: PoolConnectionProxy,
    branch_id: int | None,
    specialty_id: int | None,
) -> list[dict]:
    where = ["1=1"]
    args: list[object] = []

    if branch_id is not None:
        args.append(branch_id)
        where.append(f"s.branch_id = ${len(args)}")
    if specialty_id is not None:
        args.append(specialty_id)
        where.append(
            f"EXISTS (SELECT 1 FROM doctor_specialty ds "
            f"WHERE ds.staff_id = d.staff_id "
            f"AND ds.specialty_id = ${len(args)})"
        )

    where_sql = " AND ".join(where)
    rows = await conn.fetch(
        f"""
        SELECT d.staff_id,
               s.first_name || ' ' || s.last_name AS doctor_name,
               s.branch_id, b.branch_name,
               d.license_no, d.consultation_fee,
               COALESCE(
                   (SELECT jsonb_agg(sp.specialty_name ORDER BY sp.specialty_name)
                    FROM doctor_specialty ds
                    JOIN specialty sp ON sp.specialty_id = ds.specialty_id
                    WHERE ds.staff_id = d.staff_id),
                   '[]'::jsonb
               ) AS specialties
        FROM doctor d
        JOIN staff s ON s.staff_id = d.staff_id
        JOIN branch b ON b.branch_id = s.branch_id
        WHERE {where_sql}
        ORDER BY s.first_name, s.last_name
        """,
        *args,
    )
    return [dict(r) for r in rows]
