from asyncpg.pool import PoolConnectionProxy


async def list_roles(conn: PoolConnectionProxy) -> list[dict]:
    rows = await conn.fetch(
        "SELECT role_id, role_name FROM role ORDER BY role_id"
    )
    return [dict(row) for row in rows]
