import asyncio
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import uuid4

import asyncpg

from app.core.config import Settings
from app.core.security import verify_password
from app.domains.auth.models import RefreshRecord, UserIdentity


class CredentialValidator(Protocol):
    async def authenticate(self, username: str, password: str) -> UserIdentity | None: ...


class InMemoryCredentialValidator:
    def __init__(self, username: str, password_hash: str, user: UserIdentity) -> None:
        self._username = username
        self._password_hash = password_hash
        self._user = user

    async def authenticate(self, username: str, password: str) -> UserIdentity | None:
        if username != self._username or not verify_password(password, self._password_hash):
            return None
        return self._user


class DatabaseCredentialValidator:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def authenticate(self, username: str, password: str) -> UserIdentity | None:
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT ua.staff_id, ua.username, ua.password_hash,
                       r.role_name::text AS role, s.branch_id
                FROM user_account ua
                JOIN staff s ON s.staff_id = ua.staff_id
                JOIN role r ON r.role_id = ua.role_id
                WHERE ua.username = $1
                  AND ua.account_status = 'Active'
                """,
                username,
            )
        if row is None or not verify_password(password, row["password_hash"]):
            return None
        return UserIdentity(
            staff_id=row["staff_id"],
            username=row["username"],
            role=row["role"],
            branch_id=row["branch_id"],
        )

# Need to be implemented alongside with a Database for easy Logout
class RefreshTokenStore(Protocol):
    async def save(self, record: RefreshRecord) -> None: ...

    async def get(self, token_hash: str) -> RefreshRecord | None: ...

    async def revoke(self, token_hash: str) -> None: ...

    async def revoke_family(self, family_id: str) -> None: ...

    async def rotate(self, token_hash: str, replacement: RefreshRecord) -> RefreshRecord | None: ...

# Must Be Replaced after integrating the database.
class InMemoryRefreshTokenStore:
    def __init__(self) -> None:
        self._records: dict[str, RefreshRecord] = {}
        self._lock = asyncio.Lock()

    async def save(self, record: RefreshRecord) -> None:
        async with self._lock:
            self._records[record.token_hash] = record

    async def get(self, token_hash: str) -> RefreshRecord | None:
        async with self._lock:
            record = self._records.get(token_hash)
            if record is None or record.expires_at <= datetime.now(UTC):
                return None
            return record

    async def revoke(self, token_hash: str) -> None:
        async with self._lock:
            record = self._records.get(token_hash)
            if record and record.revoked_at is None:
                self._records[token_hash] = record.model_copy(
                    update={"revoked_at": datetime.now(UTC)}
                )

    async def revoke_family(self, family_id: str) -> None:
        async with self._lock:
            revoked_at = datetime.now(UTC)
            for token_hash, record in self._records.items():
                if record.family_id == family_id and record.revoked_at is None:
                    self._records[token_hash] = record.model_copy(update={"revoked_at": revoked_at})

    async def rotate(self, token_hash: str, replacement: RefreshRecord) -> RefreshRecord | None:
        async with self._lock:
            record = self._records.get(token_hash)
            if record is None or record.expires_at <= datetime.now(UTC):
                return None
            if record.revoked_at is not None or record.replaced_by is not None:
                return record
            self._records[token_hash] = record.model_copy(
                update={"replaced_by": replacement.token_hash, "revoked_at": datetime.now(UTC)}
            )
            self._records[replacement.token_hash] = replacement
            return record


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_refresh_record(user: UserIdentity, settings: Settings) -> tuple[str, RefreshRecord]:
    raw_token = secrets.token_urlsafe(48)
    record = RefreshRecord(
        token_hash=hash_refresh_token(raw_token),
        user=user,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        family_id=str(uuid4()),
    )
    return raw_token, record