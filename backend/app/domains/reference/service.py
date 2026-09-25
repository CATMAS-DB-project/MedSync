from asyncpg.pool import PoolConnectionProxy


async def list_roles(conn: PoolConnectionProxy) -> list[dict]:
    rows = await conn.fetch(
        "SELECT role_id, role_name FROM role ORDER BY role_id"
    )
    return [dict(row) for row in rows]


async def list_specialties(conn: PoolConnectionProxy) -> list[dict]:
    rows = await conn.fetch(
        "SELECT specialty_id, specialty_name "
        "FROM specialty ORDER BY specialty_name"
    )
    return [dict(row) for row in rows]


async def create_specialty(conn: PoolConnectionProxy, name: str) -> dict:
    row = await conn.fetchrow(
        "INSERT INTO specialty (specialty_name) VALUES ($1) "
        "RETURNING specialty_id, specialty_name",
        name,
    )
    return dict(row)


async def rename_specialty(
    conn: PoolConnectionProxy, specialty_id: int, name: str
) -> dict | None:
    row = await conn.fetchrow(
        "UPDATE specialty SET specialty_name = $1 WHERE specialty_id = $2 "
        "RETURNING specialty_id, specialty_name",
        name,
        specialty_id,
    )
    return dict(row) if row else None
