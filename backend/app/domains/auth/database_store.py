from datetime import UTC, datetime

import asyncpg

from app.domains.auth.models import RefreshRecord, UserIdentity


class DatabaseRefreshTokenStore:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    @staticmethod
    def _staff_id(user: UserIdentity) -> int:
        try:
            return int(user.staff_id)
        except ValueError as error:
            raise ValueError("Database refresh tokens require an integer staff_id") from error

    @staticmethod
    def _record(row: asyncpg.Record) -> RefreshRecord:
        return RefreshRecord(
            token_hash=row["token_hash"],
            user=UserIdentity(
                staff_id=row["staff_id"],
                username=row["username"],
                role=row["role"],
                branch_id=row["branch_id"],
            ),
            expires_at=row["expires_at"],
            family_id=str(row["family_id"]),
            replaced_by=row["replaced_by_hash"],
            revoked_at=row["revoked_at"],
        )

    async def save(self, record: RefreshRecord) -> None:
        async with self._pool.acquire() as connection:
            await connection.execute(
                """
                INSERT INTO refresh_token
                    (staff_id, token_hash, family_id, expires_at)
                VALUES ($1, $2, $3::uuid, $4)
                """,
                self._staff_id(record.user),
                record.token_hash,
                record.family_id,
                record.expires_at,
            )

    async def get(self, token_hash: str) -> RefreshRecord | None:
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT rt.token_hash, rt.family_id, rt.expires_at,
                       rt.replaced_by_hash, rt.revoked_at,
                       ua.staff_id, ua.username,
                       r.role_name::text AS role,
                       s.branch_id
                FROM refresh_token rt
                JOIN user_account ua ON ua.staff_id = rt.staff_id
                JOIN staff s ON s.staff_id = ua.staff_id
                JOIN role r ON r.role_id = ua.role_id
                WHERE rt.token_hash = $1
                  AND rt.expires_at > NOW()
                """,
                token_hash,
            )
        return self._record(row) if row else None

    async def revoke(self, token_hash: str) -> None:
        async with self._pool.acquire() as connection:
            await connection.execute(
                """
                UPDATE refresh_token
                SET revoked_at = COALESCE(revoked_at, NOW())
                WHERE token_hash = $1
                """,
                token_hash,
            )

    async def revoke_family(self, family_id: str) -> None:
        async with self._pool.acquire() as connection:
            await connection.execute(
                """
                UPDATE refresh_token
                SET revoked_at = COALESCE(revoked_at, NOW())
                WHERE family_id = $1::uuid
                """,
                family_id,
            )

    async def rotate(self, token_hash: str, replacement: RefreshRecord) -> RefreshRecord | None:
        async with self._pool.acquire() as connection, connection.transaction():
            row = await connection.fetchrow(
                    """
                    SELECT rt.token_hash, rt.family_id, rt.expires_at,
                           rt.replaced_by_hash, rt.revoked_at,
                           ua.staff_id, ua.username,
                           r.role_name::text AS role,
                           s.branch_id
                    FROM refresh_token rt
                    JOIN user_account ua ON ua.staff_id = rt.staff_id
                    JOIN staff s ON s.staff_id = ua.staff_id
                    JOIN role r ON r.role_id = ua.role_id
                    WHERE rt.token_hash = $1
                    FOR UPDATE OF rt
                    """,
                    token_hash,
                )
            if row is None or row["expires_at"] <= datetime.now(UTC):
                return None

            record = self._record(row)
            if record.revoked_at is not None or record.replaced_by is not None:
                await connection.execute(
                        """
                        UPDATE refresh_token
                        SET revoked_at = COALESCE(revoked_at, NOW())
                        WHERE family_id = $1::uuid
                        """,
                        record.family_id,
                    )
                return record

            await connection.execute(
                    """
                    INSERT INTO refresh_token
                        (staff_id, token_hash, family_id, expires_at)
                    VALUES ($1, $2, $3::uuid, $4)
                    """,
                    self._staff_id(replacement.user),
                    replacement.token_hash,
                    replacement.family_id,
                    replacement.expires_at,
                )
            await connection.execute(
                    """
                    UPDATE refresh_token
                    SET revoked_at = NOW(), replaced_by_hash = $2
                    WHERE token_hash = $1
                    """,
                    token_hash,
                    replacement.token_hash,
                )
            return record