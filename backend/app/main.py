from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base

from app.routers import ingest, proposals, audit, quarantine, sources

app = FastAPI(title="Conduit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api")
app.include_router(proposals.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(quarantine.router, prefix="/api")
app.include_router(sources.router, prefix="/api")

@app.on_event("startup")
async def on_startup():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit"))
        await conn.run_sync(Base.metadata.create_all)
