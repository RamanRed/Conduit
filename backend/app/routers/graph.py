"""
Graph API router — additive endpoints only.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.extension_schemas import GraphNodeResponse, GraphEdgeResponse, LineageGraphResponse
from app.services import graph_service

router = APIRouter()


@router.get("/graph/nodes", response_model=List[GraphNodeResponse])
async def list_nodes(
    node_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return all graph nodes, optionally filtered by type."""
    nodes = await graph_service.get_all_nodes(db, node_type=node_type, limit=limit, offset=offset)
    return [GraphNodeResponse.model_validate(n) for n in nodes]


@router.get("/graph/edges", response_model=List[GraphEdgeResponse])
async def list_edges(
    relation_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return all graph edges, optionally filtered by relation type."""
    edges = await graph_service.get_all_edges(db, relation_type=relation_type, limit=limit, offset=offset)
    return [GraphEdgeResponse.model_validate(e) for e in edges]


@router.get("/graph/lineage/{entity}", response_model=LineageGraphResponse)
async def get_entity_lineage(
    entity: str,
    max_depth: int = 4,
    db: AsyncSession = Depends(get_db),
):
    """
    Traverse the graph from any node matching the entity name/id.
    Returns all reachable nodes and edges within max_depth hops.
    """
    result = await graph_service.get_lineage(db, entity_name=entity, max_depth=max_depth)
    return LineageGraphResponse(
        nodes=[GraphNodeResponse.model_validate(n) for n in result["nodes"]],
        edges=[GraphEdgeResponse.model_validate(e) for e in result["edges"]],
    )
