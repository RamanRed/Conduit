import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, AsyncSessionLocal
from app.models import Base
from app.extension_models import ExtBase

from app.routers import ingest, proposals, audit, quarantine, sources
from app.routers import skills, graph, lineage
from app.routers import insights
from app.routers import connectors

from app.core.config import settings

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

# ── Core: audit / history (PostgreSQL) ────────────────────────
app.include_router(ingest.router, prefix="/api")
app.include_router(proposals.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(quarantine.router, prefix="/api")
app.include_router(lineage.router, prefix="/api")
app.include_router(insights.router, prefix="/api")

# ── Org connections + AI knowledge graph (Connectors + Neo4j) ───
app.include_router(connectors.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(graph.router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    from sqlalchemy import text
    async with engine.begin() as conn:
        # PostgreSQL: audit & history tables only
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS description_md TEXT"))
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS suggested_skills_to_add JSONB"))
        await conn.execute(text("ALTER TABLE conduit.proposals ADD COLUMN IF NOT EXISTS enrichment_applied JSONB"))
        await conn.execute(text("ALTER TABLE conduit.pipeline_skills_ledger ADD COLUMN IF NOT EXISTS graph_node_id VARCHAR(255)"))

        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS amount_tier VARCHAR(20)"))
        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS amount_outlier BOOLEAN"))
        await conn.execute(text("ALTER TABLE public.orders_clean ADD COLUMN IF NOT EXISTS is_potential_duplicate BOOLEAN"))

        # Skills admin UI still uses PG; AI reads from Neo4j
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit_skills"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conduit_lineage"))
        await conn.run_sync(ExtBase.metadata.create_all)

    # Neo4j: AI knowledge graph (optional — degrades gracefully)
    from app.core.neo4j_client import neo4j_client
    await neo4j_client.connect()

    if neo4j_client.driver is not None:
        from app.services import connector_introspection_service, graph_knowledge_service

        # Register org warehouse as a connector
        try:
            reg = await connector_introspection_service.register_default_warehouse_connector(
                settings.WAREHOUSE_DB_URL
            )
            if reg.get("status") == "success":
                logger.info("Registered default warehouse connector (conn_id=warehouse)")
                try:
                    await connector_introspection_service.sync_connection_to_graph("warehouse")
                except Exception as exc:
                    logger.warning(f"Live schema sync failed, using demo seed: {exc}")
                    await graph_knowledge_service.seed_demo_knowledge()
            else:
                await graph_knowledge_service.seed_demo_knowledge()
        except Exception as exc:
            logger.warning(f"Connector registration failed: {exc}")
            try:
                await graph_knowledge_service.seed_demo_knowledge()
            except Exception as seed_exc:
                logger.error(f"Demo knowledge seed failed: {seed_exc}")


@app.on_event("shutdown")
async def on_shutdown():
    from app.core.neo4j_client import neo4j_client
    await neo4j_client.close()
