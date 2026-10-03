from asyncpg.pool import PoolConnectionProxy

ALLOWED_UPDATE_FIELDS = {"treatment_name", "unit_price", "category"}


async def list_treatments(
    conn: PoolConnectionProxy,
    offset: int,
    limit: int,
    category: str | None,
) -> tuple[list[dict], int]:
    if category is None:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM treatment_catalogue"
        )
        rows = await conn.fetch(
            "SELECT service_code, treatment_name, unit_price, category "
            "FROM treatment_catalogue "
            "ORDER BY service_code LIMIT $1 OFFSET $2",
            limit,
            offset,
        )
    else:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM treatment_catalogue WHERE category = $1",
            category,
        )
        rows = await conn.fetch(
            "SELECT service_code, treatment_name, unit_price, category "
            "FROM treatment_catalogue WHERE category = $1 "
            "ORDER BY service_code LIMIT $2 OFFSET $3",
            category,
            limit,
            offset,
        )
    return [dict(row) for row in rows], total


async def create_treatment(
    conn: PoolConnectionProxy,
    data: dict,
) -> dict:
    row = await conn.fetchrow(
        "INSERT INTO treatment_catalogue "
        "(service_code, treatment_name, unit_price, category) "
        "VALUES ($1, $2, $3, $4) "
        "RETURNING service_code, treatment_name, unit_price, category",
        data["service_code"],
        data["treatment_name"],
        data["unit_price"],
        data["category"],
    )
    return dict(row)


async def get_treatment(
    conn: PoolConnectionProxy,
    service_code: str,
) -> dict | None:
    row = await conn.fetchrow(
        "SELECT service_code, treatment_name, unit_price, category "
        "FROM treatment_catalogue WHERE service_code = $1",
        service_code,
    )
    return dict(row) if row else None


async def update_treatment(
    conn: PoolConnectionProxy,
    service_code: str,
    data: dict,
) -> dict | None:
    fields = [field for field in data if field in ALLOWED_UPDATE_FIELDS]
    assignments = ", ".join(
        f"{field} = ${index}" for index, field in enumerate(fields, start=1)
    )
    values = [data[field] for field in fields]
    values.append(service_code)

    row = await conn.fetchrow(
        f"UPDATE treatment_catalogue SET {assignments} "
        f"WHERE service_code = ${len(values)} "
        "RETURNING service_code, treatment_name, unit_price, category",
        *values,
    )
    return dict(row) if row else None
