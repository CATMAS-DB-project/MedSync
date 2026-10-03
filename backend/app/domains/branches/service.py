from asyncpg.pool import PoolConnectionProxy


async def list_branches(conn: PoolConnectionProxy) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT b.branch_id, b.branch_name, b.address, b.contact_number,
               b.manager_staff_id,
               concat_ws(' ', s.first_name, s.last_name) AS manager_name
        FROM branch AS b
        LEFT JOIN staff AS s ON s.staff_id = b.manager_staff_id
        ORDER BY b.branch_id
        """
    )
    return [dict(row) for row in rows]


async def get_branch(conn: PoolConnectionProxy, branch_id: int) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT b.branch_id, b.branch_name, b.address, b.contact_number,
               b.manager_staff_id,
               concat_ws(' ', s.first_name, s.last_name) AS manager_name
        FROM branch AS b
        LEFT JOIN staff AS s ON s.staff_id = b.manager_staff_id
        WHERE b.branch_id = $1
        """,
        branch_id,
    )
    return dict(row) if row else None


async def create_branch(conn: PoolConnectionProxy, fields: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO branch (branch_name, address, contact_number, manager_staff_id)
        VALUES ($1, $2, $3, $4)
        RETURNING branch_id, branch_name, address, contact_number, manager_staff_id
        """,
        fields["branch_name"],
        fields["address"],
        fields.get("contact_number"),
        fields.get("manager_staff_id"),
    )
    return dict(row)


async def update_branch(
    conn: PoolConnectionProxy, branch_id: int, fields: dict
) -> dict | None:
    columns = {
        "branch_name": "branch_name",
        "address": "address",
        "contact_number": "contact_number",
        "manager_staff_id": "manager_staff_id",
    }
    assignments = []
    values = []
    for key, value in fields.items():
        assignments.append(f"{columns[key]} = ${len(values) + 1}")
        values.append(value)
    values.append(branch_id)
    row = await conn.fetchrow(
        "UPDATE branch SET " + ", ".join(assignments)
        + f" WHERE branch_id = ${len(values)}"
        + " RETURNING branch_id, branch_name, address, contact_number, manager_staff_id",
        *values,
    )
    return dict(row) if row else None
