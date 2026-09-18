from fastapi import FastAPI

from app.domains.auth.router import router as auth_router

app = FastAPI(title="CATMS API", version="1.0.0")

app.include_router(auth_router, prefix="/api/v1")

@app.get("/api/health")
async def health():
    return {"status": "ok"}
