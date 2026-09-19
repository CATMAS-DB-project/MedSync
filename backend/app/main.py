from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.db import database_lifespan
from app.domains.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with database_lifespan(get_settings()) as pool:
        app.state.db_pool = pool
        yield


app = FastAPI(title="CATMS API", version="1.0.0", lifespan=lifespan)

app.include_router(auth_router, prefix="/api/v1")

@app.get("/api/health")
async def health():
    return {"status": "ok"}
