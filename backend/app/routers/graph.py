"""
Graph API router — all endpoints are additive.
Existing /api/* routes are untouched.

Endpoints:
  GET  /api/graph/nodes                  list nodes
  POST /api/graph/nodes                  create node
  GET  /api/graph/edges                  list edges
  POST /api/graph/edges                  create edge
  GET  /api/graph/neighbors/{node_id}    immediate neighbours
  GET  /api/graph/lineage/{entity}       BFS traversal
  GET  /api/graph/impact/{entity}        reverse BFS — what depends on this?
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.extension_schemas import (
    GraphNodeResponse,
    GraphEdgeResponse,
    LineageGraphResponse,
    CreateGraphNodeRequest,
    CreateGraphEdgeRequest,
    NeighborDetail,
    NeighborsResponse,
    ImpactedNode,
    ImpactAnalysisResponse,
)
from app.services import graph_service

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Node endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/graph/nodes", response_model=List[GraphNodeResponse])
async def list_nodes(
    node_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return all graph nodes, optionally filtered by type."""
    nodes = await graph_service.get_all_nodes(
        db, node_type=node_type, limit=limit, offset=offset
    )
    return [GraphNodeResponse.model_validate(n) for n in nodes]


@router.post("/graph/nodes", response_model=GraphNodeResponse, status_code=201)
async def create_node(
    req: CreateGraphNodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new graph node.

    Use get_or_create semantics when you want idempotent creation
    (same node_type + entity_id → returns existing node).
    This endpoint always creates — use the /lineage or /neighbors
    reads first to check if a node already exists.
    """
    try:
        node = await graph_service.get_or_create_node(
            db,
            node_type=req.node_type,
            entity_id=req.entity_id,
            entity_name=req.entity_name,
            metadata=req.metadata,
        )
        return GraphNodeResponse.model_validate(node)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ─────────────────────────────────────────────────────────────────────────────
#  Edge endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/graph/edges", response_model=List[GraphEdgeResponse])
async def list_edges(
    relation_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return all graph edges, optionally filtered by relation type."""
    edges = await graph_service.get_all_edges(
        db, relation_type=relation_type, limit=limit, offset=offset
    )
    return [GraphEdgeResponse.model_validate(e) for e in edges]


@router.post("/graph/edges", response_model=GraphEdgeResponse, status_code=201)
async def create_edge(
    req: CreateGraphEdgeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a directed edge between two existing graph nodes.

    relation_type must be one of:
      BELONGS_TO | DEPENDS_ON | USES_SKILL | FOREIGN_KEY_OF |
      AFFECTS_KPI | GENERATED_BY | TRANSFORMS_INTO | MUTATES_VIA | PROTECTED_BY
    """
    try:
        edge = await graph_service.get_or_create_edge(
            db,
            source_node_id=req.source_node_id,
            target_node_id=req.target_node_id,
            relation_type=req.relation_type,
            confidence_score=req.confidence_score,
        )
        return GraphEdgeResponse.model_validate(edge)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ─────────────────────────────────────────────────────────────────────────────
#  Traversal endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/graph/neighbors/{node_id}", response_model=NeighborsResponse)
async def get_neighbors(
    node_id: int,
    direction: str = "both",   # "out" | "in" | "both"
    db: AsyncSession = Depends(get_db),
):
    """
    Return every node one hop away from node_id.

    direction:
      - "out"  → only edges where this node is the source
      - "in"   → only edges where this node is the target
      - "both" → union (default)
    """
    if direction not in ("out", "in", "both"):
        raise HTTPException(
            status_code=400,
            detail="direction must be 'out', 'in', or 'both'",
        )

    result = await graph_service.get_neighbors(db, node_id=node_id, direction=direction)

    neighbors: List[NeighborDetail] = []
    for item in result.get("outbound", []):
        neighbors.append(
            NeighborDetail(
                direction="outbound",
                relation_type=item["edge"].relation_type,
                confidence_score=item["edge"].confidence_score,
                node=GraphNodeResponse.model_validate(item["node"]),
            )
        )
    for item in result.get("inbound", []):
        neighbors.append(
            NeighborDetail(
                direction="inbound",
                relation_type=item["edge"].relation_type,
                confidence_score=item["edge"].confidence_score,
                node=GraphNodeResponse.model_validate(item["node"]),
            )
        )

    return NeighborsResponse(node_id=node_id, neighbors=neighbors, total=len(neighbors))


@router.get("/graph/lineage/{entity}", response_model=LineageGraphResponse)
async def get_entity_lineage(
    entity: str,
    max_depth: int = 4,
    db: AsyncSession = Depends(get_db),
):
    """
    BFS traversal from any node matching the entity name or id.
    Returns all reachable nodes and edges within max_depth hops.
    Edges are deduplicated (bug fix over the original draft).
    """
    result = await graph_service.get_lineage(
        db, entity_name=entity, max_depth=max_depth
    )
    return LineageGraphResponse(
        nodes=[GraphNodeResponse.model_validate(n) for n in result["nodes"]],
        edges=[GraphEdgeResponse.model_validate(e) for e in result["edges"]],
    )


@router.get("/graph/impact/{entity}", response_model=ImpactAnalysisResponse)
async def get_impact_analysis(
    entity: str,
    max_depth: int = 4,
    db: AsyncSession = Depends(get_db),
):
    """
    Reverse BFS impact analysis.

    Given an entity name, returns all nodes that *depend on* it
    — directly or transitively — up to max_depth hops away.

    Example:
      GET /api/graph/impact/customers
      → Returns: orders_clean (DEPENDS_ON, depth 1),
                 monthly_revenue (AFFECTS_KPI, depth 2), ...

    This answers the question:
      "If I change the 'customers' table, what else might break?"
    """
    result = await graph_service.get_impact_analysis(
        db, entity_name=entity, max_depth=max_depth
    )

    impacted = [
        ImpactedNode(
            node=GraphNodeResponse.model_validate(item["node"]),
            depth=item["depth"],
            relation_type=item["relation_type"],
            path=item["path"],
        )
        for item in result["impacted_nodes"]
    ]

    return ImpactAnalysisResponse(
        entity=entity,
        start_nodes=[
            GraphNodeResponse.model_validate(n) for n in result["start_nodes"]
        ],
        impacted_nodes=impacted,
        total_impacted=result["total_impacted"],
    )
