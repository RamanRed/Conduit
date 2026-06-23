import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, AsyncSessionLocal
from app.models import Base
from app.extension_models import ExtBase  # NEW — extension model base

from app.routers import ingest, proposals, audit, quarantine, sources
from app.routers import skills, graph, lineage  # NEW — extension routers
from app.routers import insights  # NEW — insight engine router
from app.routers import connectors  # NEW — universal database connector router

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

# ── Existing routers (UNCHANGED) ──────────────────────────────
app.include_router(ingest.router, prefix="/api")
app.include_router(proposals.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(quarantine.router, prefix="/api")
app.include_router(sources.router, prefix="/api")

# ── Extension routers (NEW, additive) ─────────────────────────
app.include_router(skills.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(lineage.router, prefix="/api")
app.include_router(insights.router, prefix="/api")  # NEW — insight engine
app.include_router(connectors.router, prefix="/api")  # NEW — universal database connectors


@app.on_event("startup")
async def on_startup():
    from sqlalchemy import text
    async with engine.begin() as conn:
        # Existing schema (UNCHANGED)
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS description_md TEXT"))
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS suggested_skills_to_add JSONB"))
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS enrichment_applied JSONB"))
        await conn.execute(text("ALTER TABLE conduit.pipeline_skills_ledger ADD COLUMN IF NOT EXISTS graph_node_id VARCHAR(255)"))

        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS amount_tier VARCHAR(20)"))
        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS amount_outlier BOOLEAN"))
        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS is_potential_duplicate BOOLEAN"))

        # NEW — extension schemas (purely additive)

        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit_skills"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit_graph"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit_lineage"))
        await conn.run_sync(ExtBase.metadata.create_all)

    # Initialize Neo4j Client connection
    from app.core.neo4j_client import neo4j_client
    await neo4j_client.connect()

    # Sync PostgreSQL metadata catalog to Neo4j
    try:
        from app.services import graph_service
        async with AsyncSessionLocal() as session:
            await graph_service.sync_metadata_catalog_from_pg(session)
    except Exception as exc:
        logger.error(f"Startup metadata catalog sync failed: {exc}")


@app.on_event("shutdown")
async def on_shutdown():
    from app.core.neo4j_client import neo4j_client
    await neo4j_client.close()

