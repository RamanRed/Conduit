"""
Connectors API router — exposes the universal database connection factory
as REST endpoints.

Endpoints:
  POST   /api/connectors/register      Register a new external database connection
  GET    /api/connectors               List all registered connections
  POST   /api/connectors/query         Execute a query against a registered connection
  DELETE /api/connectors/{conn_id}     Disconnect and remove a connection
  GET    /api/connectors/providers     List all supported database provider types
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel, Field

from app.connectors.db_factory import factory
from app.connectors.models.credentials import (
    ConnectionRequest, QueryRequest, DBType, CRED_MODELS,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Registration
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/connectors/register")
async def register_connection(req: ConnectionRequest):
    """
    Validate credentials, test connectivity, and register a persistent
    connection to an external database.

    Supported providers: postgresql, mysql, mongodb, neo4j, supabase,
    databricks, snowflake, redis, pinecone, bigquery, sqlite, clickhouse
    """
    result = await factory.register_connection(
        conn_id=req.conn_id,
        db_type=req.db_type.value,
        credentials=req.credentials,
        read_only=req.read_only,
        display_name=req.display_name,
    )
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  Listing
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/connectors")
async def list_connections():
    """Return metadata for every registered connection (credentials are never exposed)."""
    return factory.list_connections()


@router.get("/connectors/providers")
async def list_providers():
    """Return the list of supported database provider types."""
    return {
        "providers": [
            {
                "type": db_type,
                "credential_fields": list(model.model_fields.keys()),
            }
            for db_type, model in CRED_MODELS.items()
            if db_type != "postgres"  # skip alias, show 'postgresql' only
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Query execution
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/connectors/query")
async def execute_query(req: QueryRequest):
    """
    Execute a query against a registered connection.

    Read-only connections will block INSERT/UPDATE/DELETE/DROP/etc.
    Results are capped at `limit` rows (default 1000, max 10000).
    """
    try:
        result = await factory.execute_query(
            conn_id=req.conn_id,
            query=req.query,
            params=req.params,
            limit=req.limit,
        )
        return result
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(exc)}")


# ─────────────────────────────────────────────────────────────────────────────
#  Disconnect
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/connectors/{conn_id}")
async def disconnect(conn_id: str):
    """Gracefully close and remove a registered connection."""
    if conn_id not in factory.connections:
        raise HTTPException(status_code=404, detail=f"Connection '{conn_id}' not found")
    return await factory.disconnect(conn_id)
