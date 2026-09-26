from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import database_lifespan
from app.core.exceptions import register_exception_handlers
from app.domains.appointment.router import router as appointment_router
from app.domains.auth.router import router as auth_router
from app.domains.reference.router import router as reference_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with database_lifespan(settings) as _pool:
        yield


app = FastAPI(title="CATMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(appointment_router, prefix="/api/v1")
app.include_router(reference_router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok"}