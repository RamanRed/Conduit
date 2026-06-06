"""
Graph Service
Manages nodes and directed edges in the conduit_graph schema.
Supports dependency traversal, lineage BFS, impact analysis, and
automatic node/edge creation from execution events.

Changes vs original draft:
  - get_lineage(): tracks visited_edge_ids to prevent duplicate edge entries
    in the BFS result (same edge was being appended from both endpoints).
  - NEW: get_impact_analysis() — reverse BFS to find what depends on an entity.
  - NEW: auto_link_execution() — idempotent graph population from execution results.
         Called from execution_service.py; never raises.
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from app.extension_models import GraphNode, GraphEdge


# ─────────────────────────────────────────────────────────────────────────────
#  Basic CRUD
# ─────────────────────────────────────────────────────────────────────────────

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
    or create a new one.  Idempotent — safe to call multiple times.

    STAGE 5 FIX: IntegrityError catch for race-condition safety.
    Two concurrent requests may both pass the SELECT check; the DB
    unique constraint catches the duplicate INSERT, and we re-query.
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
    try:
        return await create_node(db, node_type, entity_id, entity_name, metadata)
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(GraphNode).where(
                GraphNode.node_type == node_type,
                GraphNode.entity_id == entity_id,
            )
        )
        return result.scalars().first()


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


async def get_or_create_edge(
    db: AsyncSession,
    source_node_id: int,
    target_node_id: int,
    relation_type: str,
    confidence_score: float = 1.0,
) -> GraphEdge:
    """
    Return an existing edge matching (source, target, relation_type),
    or create it.  Prevents duplicate edges in auto-linking scenarios.

    STAGE 5 FIX: IntegrityError catch mirrors get_or_create_node().
    """
    result = await db.execute(
        select(GraphEdge).where(
            GraphEdge.source_node_id == source_node_id,
            GraphEdge.target_node_id == target_node_id,
            GraphEdge.relation_type == relation_type,
        )
    )
    existing = result.scalars().first()
    if existing:
        return existing
    try:
        return await create_edge(db, source_node_id, target_node_id, relation_type, confidence_score)
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(GraphEdge).where(
                GraphEdge.source_node_id == source_node_id,
                GraphEdge.target_node_id == target_node_id,
                GraphEdge.relation_type == relation_type,
            )
        )
        return result.scalars().first()


# ─────────────────────────────────────────────────────────────────────────────
#  List queries
# ─────────────────────────────────────────────────────────────────────────────

async def get_all_nodes(
    db: AsyncSession,
    node_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[GraphNode]:
    stmt = select(GraphNode)
    if node_type:
        stmt = stmt.where(GraphNode.node_type == node_type)
    stmt = stmt.order_by(GraphNode.id).offset(offset).limit(limit)
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
    stmt = stmt.order_by(GraphEdge.id).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ─────────────────────────────────────────────────────────────────────────────
#  Traversal
# ─────────────────────────────────────────────────────────────────────────────

async def get_neighbors(
    db: AsyncSession,
    node_id: int,
    direction: str = "both",   # "out" | "in" | "both"
) -> dict:
    """
    Return all nodes one hop away from node_id, with their connecting edge.

    Returns:
        {
            "outbound": [{"edge": GraphEdge, "node": GraphNode}],
            "inbound":  [{"edge": GraphEdge, "node": GraphNode}],
        }
    """
    outbound = []
    inbound  = []

    if direction in ("out", "both"):
        res = await db.execute(
            select(GraphEdge).where(GraphEdge.source_node_id == node_id)
        )
        for edge in res.scalars().all():
            node_res = await db.execute(
                select(GraphNode).where(GraphNode.id == edge.target_node_id)
            )
            node = node_res.scalars().first()
            if node:
                outbound.append({"edge": edge, "node": node})

    if direction in ("in", "both"):
        res = await db.execute(
            select(GraphEdge).where(GraphEdge.target_node_id == node_id)
        )
        for edge in res.scalars().all():
            node_res = await db.execute(
                select(GraphNode).where(GraphNode.id == edge.source_node_id)
            )
            node = node_res.scalars().first()
            if node:
                inbound.append({"edge": edge, "node": node})

    return {"outbound": outbound, "inbound": inbound}


async def get_lineage(
    db: AsyncSession,
    entity_name: str,
    max_depth: int = 5,
) -> dict:
    """
    BFS traversal starting from any node whose entity_name (or entity_id)
    matches.  Returns all reachable nodes and edges within max_depth hops.

    BUG FIX: added visited_edge_ids to prevent duplicate edges.
    The original code appended the same GraphEdge object each time either
    of its endpoints was visited, resulting in duplicates in collected_edges.
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

    visited_node_ids: set = set()
    visited_edge_ids: set = set()   # ← FIX: was missing
    collected_nodes:  List[GraphNode] = []
    collected_edges:  List[GraphEdge] = []

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
            # ← FIX: only append each edge once
            if edge.id not in visited_edge_ids:
                visited_edge_ids.add(edge.id)
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
    """Return all nodes that node_id directly DEPENDS_ON."""
    edges_res = await db.execute(
        select(GraphEdge).where(
            GraphEdge.source_node_id == node_id,
            GraphEdge.relation_type == "DEPENDS_ON",
        )
    )
    edges = edges_res.scalars().all()

    deps: List[GraphNode] = []
    for edge in edges:
        node_res = await db.execute(
            select(GraphNode).where(GraphNode.id == edge.target_node_id)
        )
        node = node_res.scalars().first()
        if node:
            deps.append(node)
    return deps


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Impact analysis
# ─────────────────────────────────────────────────────────────────────────────

async def get_impact_analysis(
    db: AsyncSession,
    entity_name: str,
    max_depth: int = 4,
) -> dict:
    """
    Reverse BFS: given an entity, discover every upstream node that
    depends on it (directly or transitively).

    Use case:
        "customer_id is changing from INT → VARCHAR.  What breaks?"
        → Graph traverses: customers → orders → invoices → revenue_dashboard

    Returns:
        {
            "entity":          str,
            "start_nodes":     [GraphNode],   # nodes matching the entity name
            "impacted_nodes":  [
                {
                    "node":          GraphNode,
                    "depth":         int,
                    "relation_type": str,
                    "path":          [str],  # entity names from target to this node
                }
            ],
            "total_impacted":  int,
        }
    """
    # 1. Find entity start nodes
    start_res = await db.execute(
        select(GraphNode).where(
            or_(
                GraphNode.entity_name.ilike(f"%{entity_name}%"),
                GraphNode.entity_id.ilike(f"%{entity_name}%"),
            )
        )
    )
    start_nodes: List[GraphNode] = start_res.scalars().all()

    if not start_nodes:
        return {
            "entity": entity_name,
            "start_nodes": [],
            "impacted_nodes": [],
            "total_impacted": 0,
        }

    # 2. BFS in reverse direction — find nodes with edges pointing TO the target
    visited: set = set(n.id for n in start_nodes)
    impacted: List[dict] = []

    # queue: (node_id, depth, path_so_far, relation_type_used)
    queue = [(n.id, 0, [n.entity_name or n.entity_id], "") for n in start_nodes]

    while queue:
        current_id, depth, path, rel = queue.pop(0)
        if depth >= max_depth:
            continue

        # Edges where the CURRENT node is the TARGET (i.e. source depends on us)
        edges_res = await db.execute(
            select(GraphEdge).where(GraphEdge.target_node_id == current_id)
        )
        for edge in edges_res.scalars().all():
            src_id = edge.source_node_id
            if src_id not in visited:
                visited.add(src_id)
                node_res = await db.execute(
                    select(GraphNode).where(GraphNode.id == src_id)
                )
                node = node_res.scalars().first()
                if node:
                    new_path = path + [node.entity_name or node.entity_id]
                    impacted.append({
                        "node": node,
                        "depth": depth + 1,
                        "relation_type": edge.relation_type,
                        "path": new_path,
                    })
                    queue.append((src_id, depth + 1, new_path, edge.relation_type))

    return {
        "entity": entity_name,
        "start_nodes": start_nodes,
        "impacted_nodes": impacted,
        "total_impacted": len(impacted),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Execution auto-linking
# ─────────────────────────────────────────────────────────────────────────────

async def auto_link_execution(
    db: AsyncSession,
    proposal_id: str,
    source_filename: str,
    target_table: str,
    skill_name: Optional[str] = None,
) -> None:
    """
    Auto-populate the relationship graph after a successful execution.

    Creates:
        FILE node  ──TRANSFORMS_INTO──▶  TABLE node
        TABLE node ──USES_SKILL──────▶  SKILL node  (if skill_name given)
        PIPELINE node ──GENERATED_BY──▶  TABLE node

    All operations are idempotent (get_or_create_edge).
    Never raises — wrapped so it cannot break the execution flow.
    """
    try:
        # FILE node representing the uploaded CSV
        file_node = await get_or_create_node(
            db, "FILE", source_filename, source_filename,
            {"proposal_id": proposal_id},
        )

        # TABLE node representing the target warehouse table
        table_node = await get_or_create_node(
            db, "TABLE", target_table, target_table, {}
        )

        # FILE ──TRANSFORMS_INTO──▶ TABLE
        await get_or_create_edge(
            db, file_node.id, table_node.id, "TRANSFORMS_INTO", 1.0
        )

        # PIPELINE node  (tracks the proposal itself)
        pipeline_node = await get_or_create_node(
            db, "PIPELINE", proposal_id, f"pipeline_{proposal_id[:8]}",
            {"proposal_id": proposal_id},
        )
        # PIPELINE ──GENERATED_BY──▶ TABLE
        await get_or_create_edge(
            db, pipeline_node.id, table_node.id, "GENERATED_BY", 1.0
        )

        # SKILL node (the transformation skill applied)
        if skill_name:
            skill_node = await get_or_create_node(
                db, "SKILL", skill_name, skill_name, {"auto_linked": True}
            )
            # TABLE ──USES_SKILL──▶ SKILL
            await get_or_create_edge(
                db, table_node.id, skill_node.id, "USES_SKILL", 1.0
            )

    except Exception:
        # Must never propagate — graph linking is supplemental
        pass
