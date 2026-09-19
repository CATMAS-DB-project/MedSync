from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg
from asyncpg.pool import PoolConnectionProxy

from app.core.config import get_settings


_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
        command_timeout=30,
        statement_cache_size=0,
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool is not initialised. Did the FastAPI lifespan run?")
    return _pool


@asynccontextmanager
async def get_conn() -> AsyncGenerator[PoolConnectionProxy, None]:
    async with get_pool().acquire() as conn:
        yield conn


@asynccontextmanager
async def with_transaction(staff_id: int | None = None) -> AsyncGenerator[PoolConnectionProxy, None]:
    async with get_pool().acquire() as conn:
        async with conn.transaction():
            if staff_id is not None:
                await conn.execute(
                    "SELECT set_config('app.current_staff_id', $1, true)",
                    str(staff_id),
                )
            yield conn