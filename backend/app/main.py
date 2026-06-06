import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base

from app.routers import ingest, proposals, audit, quarantine, sources

logger = logging.getLogger("conduit.api")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    logger.addHandler(handler)
    logger.propagate = False

app = FastAPI(title="Conduit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000
    
    logger.info(
        f"Request: {request.method} {request.url.path} "
        f"Query Params: {dict(request.query_params)} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration_ms:.2f}ms"
    )
    return response

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
