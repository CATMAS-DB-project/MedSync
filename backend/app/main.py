from contextlib import asynccontextmanager
<<<<<<< HEAD

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import close_pool, init_pool
from app.core.exceptions import register_exception_handlers
from app.domains.auth.router import router as auth_router

=======

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
>>>>>>> 5541429 (implement database-backed refresh token store and update authentication flow)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    try:
        yield
    finally:
        await close_pool()


app = FastAPI(title="CATMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # move to settings later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth_router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
