"""
Context Retrieval Service
Assembles a rich context bundle (related entities, skills, dependencies)
for a given target table.  In Phase 1 the bundle is stored alongside
the prompt but NOT yet injected into it — this avoids changing any
existing LLM behaviour.
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.extension_models import GraphNode, GraphEdge, Skill
from app.services import skill_registry_service, graph_service


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
            "related_skills":    [{"id", "name", "category"}],
            "dependencies":      [{"id", "name", "type"}],
            "business_context":  [str],
        }
    """
    # 1. Find graph nodes matching the target table
    lineage_data = await graph_service.get_lineage(db, entity_name=target_table, max_depth=2)
    graph_nodes = lineage_data.get("nodes", [])

    related_entities = [
        {"id": n.id, "name": n.entity_name, "type": n.node_type}
        for n in graph_nodes
        if n.entity_name and n.entity_name.lower() != target_table.lower()
    ]

    # 2. Find the node for this table specifically and get its deps
    dependencies = []
    table_nodes = [n for n in graph_nodes if n.entity_name and n.entity_name.lower() == target_table.lower()]
    if table_nodes:
        deps = await graph_service.get_dependencies(db, node_id=table_nodes[0].id)
        dependencies = [{"id": d.id, "name": d.entity_name, "type": d.node_type} for d in deps]

    # 3. Keyword search for matching skills from column names
    keywords = [target_table] + (incoming_columns or [])
    matching_skills = await skill_registry_service.find_matching_skills(db, keywords=keywords)
    related_skills = [
        {"id": s.id, "name": s.skill_name, "category": s.category}
        for s in matching_skills
    ]

    # 4. Business context strings from metadata
    business_context: List[str] = []
    for node in graph_nodes:
        if node.metadata and node.metadata.get("business_kpi_impact"):
            business_context.append(node.metadata["business_kpi_impact"])

    return {
        "target_table": target_table,
        "related_entities": related_entities,
        "related_skills": related_skills,
        "dependencies": dependencies,
        "business_context": business_context,
    }
