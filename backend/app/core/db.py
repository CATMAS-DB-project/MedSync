from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import HTTPException, Request, status

from app.core.config import Settings


async def create_pool(settings: Settings) -> asyncpg.Pool:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL must be configured to start the API")
    return await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
    )


@asynccontextmanager
async def database_lifespan(settings: Settings) -> AsyncIterator[asyncpg.Pool]:
    pool = await create_pool(settings)
    try:
        yield pool
    finally:
        await pool.close()


async def get_db_pool(request: Request) -> asyncpg.Pool:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )
    return pool