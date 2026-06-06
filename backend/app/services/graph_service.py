"""
Graph Service
Manages nodes and directed edges in the conduit_graph schema.
Supports dependency traversal and lineage path queries.
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.extension_models import GraphNode, GraphEdge


async def create_node(
    db: AsyncSession,
    node_type: str,
    entity_id: str,
    entity_name: str,
    metadata: Optional[dict] = None,
) -> GraphNode:
    """Create a graph node and return it."""
    node = GraphNode(
        node_type=node_type,
        entity_id=entity_id,
        entity_name=entity_name,
        node_metadata=metadata or {},
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def get_or_create_node(
    db: AsyncSession,
    node_type: str,
    entity_id: str,
    entity_name: str,
    metadata: Optional[dict] = None,
) -> GraphNode:
    """
    Return an existing node matching (node_type, entity_id),
    or create a new one.
    """
    result = await db.execute(
        select(GraphNode).where(
            GraphNode.node_type == node_type,
            GraphNode.entity_id == entity_id,
        )
    )
    existing = result.scalars().first()
    if existing:
        return existing
    return await create_node(db, node_type, entity_id, entity_name, metadata)


async def create_edge(
    db: AsyncSession,
    source_node_id: int,
    target_node_id: int,
    relation_type: str,
    confidence_score: float = 1.0,
) -> GraphEdge:
    """Create a directed edge between two existing nodes."""
    edge = GraphEdge(
        source_node_id=source_node_id,
        target_node_id=target_node_id,
        relation_type=relation_type,
        confidence_score=confidence_score,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


async def get_all_nodes(
    db: AsyncSession,
    node_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[GraphNode]:
    stmt = select(GraphNode)
    if node_type:
        stmt = stmt.where(GraphNode.node_type == node_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_all_edges(
    db: AsyncSession,
    relation_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[GraphEdge]:
    stmt = select(GraphEdge)
    if relation_type:
        stmt = stmt.where(GraphEdge.relation_type == relation_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_neighbors(
    db: AsyncSession,
    node_id: int,
    direction: str = "both",  # "out", "in", "both"
) -> dict:
    """
    Return all nodes that are one hop away from node_id,
    along with the edge connecting them.
    direction="out"  → edges where source=node_id
    direction="in"   → edges where target=node_id
    direction="both" → union of above
    """
    outbound: List[GraphEdge] = []
    inbound: List[GraphEdge] = []

    if direction in ("out", "both"):
        res = await db.execute(
            select(GraphEdge).where(GraphEdge.source_node_id == node_id)
        )
        outbound = res.scalars().all()

    if direction in ("in", "both"):
        res = await db.execute(
            select(GraphEdge).where(GraphEdge.target_node_id == node_id)
        )
        inbound = res.scalars().all()

    return {"outbound": outbound, "inbound": inbound}


async def get_lineage(
    db: AsyncSession,
    entity_name: str,
    max_depth: int = 5,
) -> dict:
    """
    BFS traversal starting from any node whose entity_name matches.
    Returns a dict with nodes and edges reachable within max_depth hops.
    """
    # Find starting nodes
    start_res = await db.execute(
        select(GraphNode).where(
            or_(
                GraphNode.entity_name.ilike(f"%{entity_name}%"),
                GraphNode.entity_id.ilike(f"%{entity_name}%"),
            )
        )
    )
    start_nodes = start_res.scalars().all()

    visited_node_ids = set()
    collected_nodes = []
    collected_edges = []

    queue = [(n.id, 0) for n in start_nodes]
    for n in start_nodes:
        visited_node_ids.add(n.id)
        collected_nodes.append(n)

    while queue:
        current_id, depth = queue.pop(0)
        if depth >= max_depth:
            continue

        edges_res = await db.execute(
            select(GraphEdge).where(
                or_(
                    GraphEdge.source_node_id == current_id,
                    GraphEdge.target_node_id == current_id,
                )
            )
        )
        edges = edges_res.scalars().all()

        for edge in edges:
            collected_edges.append(edge)
            for next_id in (edge.source_node_id, edge.target_node_id):
                if next_id not in visited_node_ids:
                    visited_node_ids.add(next_id)
                    node_res = await db.execute(
                        select(GraphNode).where(GraphNode.id == next_id)
                    )
                    node = node_res.scalars().first()
                    if node:
                        collected_nodes.append(node)
                        queue.append((next_id, depth + 1))

    return {"nodes": collected_nodes, "edges": collected_edges}


async def get_dependencies(
    db: AsyncSession,
    node_id: int,
) -> List[GraphNode]:
    """
    Return all nodes that node_id directly DEPENDS_ON.
    """
    edges_res = await db.execute(
        select(GraphEdge).where(
            GraphEdge.source_node_id == node_id,
            GraphEdge.relation_type == "DEPENDS_ON",
        )
    )
    edges = edges_res.scalars().all()

    deps = []
    for edge in edges:
        node_res = await db.execute(
            select(GraphNode).where(GraphNode.id == edge.target_node_id)
        )
        node = node_res.scalars().first()
        if node:
            deps.append(node)
    return deps
