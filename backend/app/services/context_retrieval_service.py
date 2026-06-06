"""
Context Retrieval Service
Assembles a rich context bundle (related entities, skills, dependencies)
for a given target table.

Phase 1  — bundle is built, stored in ProposalContext, but NOT injected into
            the LLM prompt.  This keeps existing AI behaviour completely intact.
Phase 2+ — replace this note with prompt injection logic.

BUG FIX vs original draft:
  node.metadata  →  node.node_metadata
  (node.metadata on a SQLAlchemy instance resolves to the class-level MetaData
   object, not the JSONB column.  The ORM attribute is node_metadata.)
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.extension_models import GraphNode, GraphEdge, Skill
from app.services import skill_registry_service, graph_service


# ─────────────────────────────────────────────────────────────────────────────
#  Core bundle builder
# ─────────────────────────────────────────────────────────────────────────────

async def build_context_bundle(
    db: AsyncSession,
    target_table: str,
    incoming_columns: Optional[List[str]] = None,
) -> dict:
    """
    Build a context bundle for a target table.

    Returns:
        {
            "target_table":      str,
            "related_entities":  [{"id", "name", "type"}],
            "related_skills":    [{"id", "name", "category", "description"}],
            "dependencies":      [{"id", "name", "type"}],
            "business_context":  [str],
            "pii_columns":       [str],   # columns flagged as PII in the graph
        }
    """
    # 1. BFS traversal from the target table node (depth 2 is sufficient for context)
    lineage_data = await graph_service.get_lineage(
        db, entity_name=target_table, max_depth=2
    )
    graph_nodes: List[GraphNode] = lineage_data.get("nodes", [])

    # 2. Related entities (all nodes within 2 hops, excluding the target itself)
    related_entities = [
        {"id": n.id, "name": n.entity_name, "type": n.node_type}
        for n in graph_nodes
        if n.entity_name and n.entity_name.lower() != target_table.lower()
    ]

    # 3. Direct DEPENDS_ON dependencies for the target table node
    dependencies: List[dict] = []
    pii_columns: List[str] = []
    table_nodes = [
        n for n in graph_nodes
        if n.entity_name and n.entity_name.lower() == target_table.lower()
    ]
    if table_nodes:
        target_node_id = table_nodes[0].id
        deps = await graph_service.get_dependencies(db, node_id=target_node_id)
        dependencies = [
            {"id": d.id, "name": d.entity_name, "type": d.node_type}
            for d in deps
        ]

        # Collect PII column names from node metadata (COLUMN-type nodes)
        for node in graph_nodes:
            if (
                node.node_type == "COLUMN"
                and node.node_metadata  # ← FIXED: was node.metadata (bug)
                and node.node_metadata.get("is_pii")
            ):
                pii_columns.append(node.entity_name or "")

    # 4. Keyword skill search — use table name + column names as keywords
    keywords = [target_table] + (incoming_columns or [])
    matching_skills = await skill_registry_service.find_matching_skills(
        db, keywords=keywords, limit=10
    )
    related_skills = [
        {
            "id": s.id,
            "name": s.skill_name,
            "category": s.category,
            "description": s.description,
        }
        for s in matching_skills
    ]

    # 5. Business context strings extracted from node metadata
    #    FIX: was node.metadata (resolved to SQLAlchemy MetaData object)
    business_context: List[str] = []
    for node in graph_nodes:
        if node.node_metadata:                           # ← FIXED
            kpi = node.node_metadata.get("business_kpi_impact")   # ← FIXED
            if kpi:
                business_context.append(kpi)

    return {
        "target_table": target_table,
        "related_entities": related_entities,
        "related_skills": related_skills,
        "dependencies": dependencies,
        "business_context": business_context,
        "pii_columns": list(set(pii_columns)),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Persistence helpers (Phase 1 storage)
# ─────────────────────────────────────────────────────────────────────────────

async def store_proposal_context(
    db: AsyncSession,
    proposal_id: str,
    target_table: str,
    bundle: dict,
) -> None:
    """
    Persist a context bundle alongside a proposal.
    Called from ingest.py — wrapped in try/except so it never breaks the
    ingest flow.  Uses upsert logic so re-ingesting the same proposal_id
    just refreshes the stored bundle.
    """
    from app.extension_models import ProposalContext  # local import avoids circular dep

    stmt = select(ProposalContext).where(ProposalContext.proposal_id == proposal_id)
    result = await db.execute(stmt)
    existing = result.scalars().first()

    if existing:
        existing.context_bundle = bundle
        existing.target_table = target_table
    else:
        db.add(ProposalContext(
            proposal_id=proposal_id,
            target_table=target_table,
            context_bundle=bundle,
        ))

    await db.commit()


async def get_proposal_context(
    db: AsyncSession,
    proposal_id: str,
) -> Optional[dict]:
    """
    Retrieve a previously stored context bundle for a proposal.
    Returns None if no context was stored (e.g. pre-Phase-1 proposals).
    """
    from app.extension_models import ProposalContext

    stmt = select(ProposalContext).where(ProposalContext.proposal_id == proposal_id)
    result = await db.execute(stmt)
    ctx = result.scalars().first()
    if not ctx:
        return None
    return {
        "proposal_id": ctx.proposal_id,
        "target_table": ctx.target_table,
        "context_bundle": ctx.context_bundle,
        "generated_at": ctx.generated_at,
    }
