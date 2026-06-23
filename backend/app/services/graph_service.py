import json
import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.neo4j_client import neo4j_client

logger = logging.getLogger("conduit.graph_service")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    logger.addHandler(handler)
    logger.propagate = False

# ─────────────────────────────────────────────────────────────────────────────
#  Basic CRUD (Neo4j Backend)
# ─────────────────────────────────────────────────────────────────────────────

async def get_or_create_node(
    db: Optional[AsyncSession],
    node_type: str,
    entity_id: str,
    entity_name: str,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Return an existing node matching entity_id, or create a new one.
    Also adds the specific node_type label (e.g. :TABLE, :PROJECT, etc.) dynamically and safely.
    """
    clean_label = "".join([c for c in node_type if c.isalnum() or c == "_"])
    query = f"""
    MERGE (n:GraphNode {{entity_id: $entity_id}})
    SET n:{clean_label}
    SET n.node_type = $node_type,
        n.entity_name = $entity_name,
        n.metadata_json = $metadata_json
    RETURN id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
    """
    metadata_json = json.dumps(metadata or {})
    records = await neo4j_client.execute_query(query, {
        "entity_id": entity_id,
        "node_type": node_type,
        "entity_name": entity_name,
        "metadata_json": metadata_json
    })
    if not records:
        raise RuntimeError("Failed to create or retrieve node in Neo4j.")
    
    rec = records[0]
    return {
        "id": rec["id"],
        "node_type": rec["node_type"],
        "entity_id": rec["entity_id"],
        "entity_name": rec["entity_name"],
        "node_metadata": json.loads(rec["metadata_json"] or "{}")
    }

async def get_or_create_edge(
    db: Optional[AsyncSession],
    source_node_id: int,
    target_node_id: int,
    relation_type: str,
    confidence_score: float = 1.0,
) -> dict:
    """
    Create a directed edge between two existing nodes in Neo4j.
    """
    clean_rel = "".join([c for c in relation_type if c.isalnum() or c == "_"])
    query = f"""
    MATCH (a:GraphNode), (b:GraphNode)
    WHERE id(a) = $source_node_id AND id(b) = $target_node_id
    MERGE (a)-[r:{clean_rel}]->(b)
    SET r.confidence_score = $confidence_score,
        r.created_at = $created_at
    RETURN id(r) AS id, id(a) AS source_node_id, id(b) AS target_node_id, type(r) AS relation_type, r.confidence_score AS confidence_score, r.created_at AS created_at
    """
    created_at = datetime.utcnow().isoformat()
    records = await neo4j_client.execute_query(query, {
        "source_node_id": source_node_id,
        "target_node_id": target_node_id,
        "confidence_score": confidence_score,
        "created_at": created_at
    })
    if not records:
        raise RuntimeError("Failed to create or retrieve edge in Neo4j.")
    
    rec = records[0]
    return {
        "id": rec["id"],
        "source_node_id": rec["source_node_id"],
        "target_node_id": rec["target_node_id"],
        "relation_type": rec["relation_type"],
        "confidence_score": rec["confidence_score"],
        "created_at": datetime.fromisoformat(rec["created_at"]) if rec.get("created_at") else datetime.utcnow()
    }

# ─────────────────────────────────────────────────────────────────────────────
#  List queries
# ─────────────────────────────────────────────────────────────────────────────

async def get_all_nodes(
    db: Optional[AsyncSession],
    node_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[dict]:
    if node_type:
        query = """
        MATCH (n:GraphNode)
        WHERE n.node_type = $node_type
        RETURN id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
        ORDER BY id
        SKIP $offset LIMIT $limit
        """
        params = {"node_type": node_type, "offset": offset, "limit": limit}
    else:
        query = """
        MATCH (n:GraphNode)
        RETURN id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
        ORDER BY id
        SKIP $offset LIMIT $limit
        """
        params = {"offset": offset, "limit": limit}
        
    records = await neo4j_client.execute_query(query, params)
    return [
        {
            "id": r["id"],
            "node_type": r["node_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "node_metadata": json.loads(r["metadata_json"] or "{}")
        }
        for r in records
    ]

async def get_all_edges(
    db: Optional[AsyncSession],
    relation_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[dict]:
    if relation_type:
        query = """
        MATCH (a:GraphNode)-[r]->(b:GraphNode)
        WHERE type(r) = $relation_type
        RETURN id(r) AS id, id(a) AS source_node_id, id(b) AS target_node_id, type(r) AS relation_type, r.confidence_score AS confidence_score, r.created_at AS created_at
        ORDER BY id
        SKIP $offset LIMIT $limit
        """
        params = {"relation_type": relation_type, "offset": offset, "limit": limit}
    else:
        query = """
        MATCH (a:GraphNode)-[r]->(b:GraphNode)
        RETURN id(r) AS id, id(a) AS source_node_id, id(b) AS target_node_id, type(r) AS relation_type, r.confidence_score AS confidence_score, r.created_at AS created_at
        ORDER BY id
        SKIP $offset LIMIT $limit
        """
        params = {"offset": offset, "limit": limit}
        
    records = await neo4j_client.execute_query(query, params)
    return [
        {
            "id": r["id"],
            "source_node_id": r["source_node_id"],
            "target_node_id": r["target_node_id"],
            "relation_type": r["relation_type"],
            "confidence_score": r["confidence_score"],
            "created_at": datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow()
        }
        for r in records
    ]

# ─────────────────────────────────────────────────────────────────────────────
#  Traversal
# ─────────────────────────────────────────────────────────────────────────────

async def get_neighbors(
    db: Optional[AsyncSession],
    node_id: int,
    direction: str = "both",
) -> dict:
    outbound = []
    inbound = []
    
    if direction in ("out", "both"):
        query = """
        MATCH (n:GraphNode)-[r]->(m:GraphNode)
        WHERE id(n) = $node_id
        RETURN id(r) AS edge_id, id(n) AS src_id, id(m) AS tgt_id, type(r) AS rel_type, r.confidence_score AS score, r.created_at AS created,
               id(m) AS m_id, m.node_type AS m_type, m.entity_id AS m_eid, m.entity_name AS m_ename, m.metadata_json AS m_meta
        """
        records = await neo4j_client.execute_query(query, {"node_id": node_id})
        for r in records:
            edge = {
                "id": r["edge_id"],
                "source_node_id": r["src_id"],
                "target_node_id": r["tgt_id"],
                "relation_type": r["rel_type"],
                "confidence_score": r["score"],
                "created_at": datetime.fromisoformat(r["created"]) if r.get("created") else datetime.utcnow()
            }
            node = {
                "id": r["m_id"],
                "node_type": r["m_type"],
                "entity_id": r["m_eid"],
                "entity_name": r["m_ename"],
                "node_metadata": json.loads(r["m_meta"] or "{}")
            }
            outbound.append({"edge": edge, "node": node})

    if direction in ("in", "both"):
        query = """
        MATCH (m:GraphNode)-[r]->(n:GraphNode)
        WHERE id(n) = $node_id
        RETURN id(r) AS edge_id, id(m) AS src_id, id(n) AS tgt_id, type(r) AS rel_type, r.confidence_score AS score, r.created_at AS created,
               id(m) AS m_id, m.node_type AS m_type, m.entity_id AS m_eid, m.entity_name AS m_ename, m.metadata_json AS m_meta
        """
        records = await neo4j_client.execute_query(query, {"node_id": node_id})
        for r in records:
            edge = {
                "id": r["edge_id"],
                "source_node_id": r["src_id"],
                "target_node_id": r["tgt_id"],
                "relation_type": r["rel_type"],
                "confidence_score": r["score"],
                "created_at": datetime.fromisoformat(r["created"]) if r.get("created") else datetime.utcnow()
            }
            node = {
                "id": r["m_id"],
                "node_type": r["m_type"],
                "entity_id": r["m_eid"],
                "entity_name": r["m_ename"],
                "node_metadata": json.loads(r["m_meta"] or "{}")
            }
            inbound.append({"edge": edge, "node": node})

    return {"outbound": outbound, "inbound": inbound}

async def get_lineage(
    db: Optional[AsyncSession],
    entity_name: str,
    max_depth: int = 5,
) -> dict:
    pattern = f"(?i).*{entity_name}.*"
    query_start = """
    MATCH (n:GraphNode)
    WHERE n.entity_name =~ $pattern OR n.entity_id =~ $pattern
    RETURN id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
    """
    start_records = await neo4j_client.execute_query(query_start, {"pattern": pattern})
    if not start_records:
        return {"nodes": [], "edges": []}

    start_ids = [r["id"] for r in start_records]
    nodes_map = {}
    edges_map = {}

    for r in start_records:
        nodes_map[r["id"]] = {
            "id": r["id"],
            "node_type": r["node_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "node_metadata": json.loads(r["metadata_json"] or "{}")
        }

    query_nodes = f"""
    MATCH path = (start:GraphNode)-[*1..{max_depth}]-(end:GraphNode)
    WHERE id(start) IN $start_ids
    UNWIND nodes(path) AS n
    RETURN DISTINCT id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
    """
    node_records = await neo4j_client.execute_query(query_nodes, {"start_ids": start_ids})
    for r in node_records:
        nodes_map[r["id"]] = {
            "id": r["id"],
            "node_type": r["node_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "node_metadata": json.loads(r["metadata_json"] or "{}")
        }

    query_rels = f"""
    MATCH path = (start:GraphNode)-[*1..{max_depth}]-(end:GraphNode)
    WHERE id(start) IN $start_ids
    UNWIND relationships(path) AS r
    RETURN DISTINCT id(r) AS id, id(startNode(r)) AS source_node_id, id(endNode(r)) AS target_node_id, type(r) AS relation_type, r.confidence_score AS confidence_score, r.created_at AS created_at
    """
    rel_records = await neo4j_client.execute_query(query_rels, {"start_ids": start_ids})
    for r in rel_records:
        edges_map[r["id"]] = {
            "id": r["id"],
            "source_node_id": r["source_node_id"],
            "target_node_id": r["target_node_id"],
            "relation_type": r["relation_type"],
            "confidence_score": r.get("confidence_score", 1.0),
            "created_at": datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow()
        }

    return {"nodes": list(nodes_map.values()), "edges": list(edges_map.values())}

async def get_dependencies(
    db: Optional[AsyncSession],
    node_id: int,
) -> List[dict]:
    query = """
    MATCH (n:GraphNode)-[:DEPENDS_ON]->(m:GraphNode)
    WHERE id(n) = $node_id
    RETURN id(m) AS id, m.node_type AS node_type, m.entity_id AS entity_id, m.entity_name AS entity_name, m.metadata_json AS metadata_json
    """
    records = await neo4j_client.execute_query(query, {"node_id": node_id})
    return [
        {
            "id": r["id"],
            "node_type": r["node_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "node_metadata": json.loads(r["metadata_json"] or "{}")
        }
        for r in records
    ]

# ─────────────────────────────────────────────────────────────────────────────
#  Impact analysis
# ─────────────────────────────────────────────────────────────────────────────

async def get_impact_analysis(
    db: Optional[AsyncSession],
    entity_name: str,
    max_depth: int = 4,
) -> dict:
    pattern = f"(?i).*{entity_name}.*"
    query_start = """
    MATCH (n:GraphNode)
    WHERE n.entity_name =~ $pattern OR n.entity_id =~ $pattern
    RETURN id(n) AS id, n.node_type AS node_type, n.entity_id AS entity_id, n.entity_name AS entity_name, n.metadata_json AS metadata_json
    """
    start_records = await neo4j_client.execute_query(query_start, {"pattern": pattern})
    if not start_records:
        return {
            "entity": entity_name,
            "start_nodes": [],
            "impacted_nodes": [],
            "total_impacted": 0,
        }

    start_ids = [r["id"] for r in start_records]
    start_nodes = [
        {
            "id": r["id"],
            "node_type": r["node_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "node_metadata": json.loads(r["metadata_json"] or "{}")
        }
        for r in start_records
    ]

    query_impact = f"""
    MATCH path = shortestPath((upstream:GraphNode)-[*1..{max_depth}]->(start:GraphNode))
    WHERE id(start) IN $start_ids AND id(upstream) <> id(start)
    RETURN id(upstream) AS id, upstream.node_type AS node_type, upstream.entity_id AS entity_id, upstream.entity_name AS entity_name, upstream.metadata_json AS metadata_json,
           length(path) AS depth, [x IN nodes(path) | x.entity_name] AS path_names, relationships(path)[0] AS r
    """
    records = await neo4j_client.execute_query(query_impact, {"start_ids": start_ids})

    impacted = []
    seen = set()
    for r in records:
        u_id = r["id"]
        if u_id in seen:
            continue
        seen.add(u_id)
        
        reversed_path = list(reversed(r["path_names"]))
        rel_type = r["r"].type if r["r"] else "DEPENDS_ON"
        
        impacted.append({
            "node": {
                "id": u_id,
                "node_type": r["node_type"],
                "entity_id": r["entity_id"],
                "entity_name": r["entity_name"],
                "node_metadata": json.loads(r["metadata_json"] or "{}")
            },
            "depth": r["depth"],
            "relation_type": rel_type,
            "path": reversed_path,
        })

    return {
        "entity": entity_name,
        "start_nodes": start_nodes,
        "impacted_nodes": impacted,
        "total_impacted": len(impacted),
    }

# ─────────────────────────────────────────────────────────────────────────────
#  Execution auto-linking
# ─────────────────────────────────────────────────────────────────────────────

async def auto_link_execution(
    db: Optional[AsyncSession],
    proposal_id: str,
    source_filename: str,
    target_table: str,
    skill_name: Optional[str] = None,
) -> None:
    """
    Auto-populate the relationship graph in Neo4j after a successful execution.
    """
    try:
        file_node = await get_or_create_node(
            db, "FILE", source_filename, source_filename,
            {"proposal_id": proposal_id},
        )

        table_node = await get_or_create_node(
            db, "TABLE", target_table, target_table, {}
        )

        await get_or_create_edge(
            db, file_node["id"], table_node["id"], "TRANSFORMS_INTO", 1.0
        )

        pipeline_node = await get_or_create_node(
            db, "PIPELINE", proposal_id, f"pipeline_{proposal_id[:8]}",
            {"proposal_id": proposal_id},
        )
        await get_or_create_edge(
            db, pipeline_node["id"], table_node["id"], "GENERATED_BY", 1.0
        )

        if skill_name:
            skill_node = await get_or_create_node(
                db, "SKILL", skill_name, skill_name, {"auto_linked": True}
            )
            await get_or_create_edge(
                db, table_node["id"], skill_node["id"], "USES_SKILL", 1.0
            )
    except Exception as exc:
        logger.error(f"Failed to auto-link execution: {exc}")

# ─────────────────────────────────────────────────────────────────────────────
#  Metadata Catalog Sync from PostgreSQL
# ─────────────────────────────────────────────────────────────────────────────

async def sync_metadata_catalog_from_pg(db: AsyncSession) -> None:
    """
    Synchronizes the PostgreSQL database metadata catalog into Neo4j using the hierarchy:
    CentralDBLink -> DbService -> Project -> Database -> StorageUnit
    """
    from sqlalchemy import select
    from app.models import WarehouseUnit, SubProject, TableMetadata, AttributeMetadata
    
    logger.info("Starting PostgreSQL metadata catalog sync to Neo4j...")
    
    # 1. Create the Central Database Link node
    central_node = await get_or_create_node(
        None,
        node_type="CENTRAL_DB_LINK",
        entity_id="central-db-link",
        entity_name="Central Database Link",
        metadata={}
    )
    
    # 2. Sync Warehouse Units (Services)
    res_warehouses = await db.execute(select(WarehouseUnit))
    warehouses = res_warehouses.scalars().all()
    warehouse_nodes = {}
    
    for wh in warehouses:
        service_id = f"dbservice_{wh.id}"
        service_node = await get_or_create_node(
            None,
            node_type="DB_SERVICE",
            entity_id=service_id,
            entity_name=wh.name,
            metadata={
                "type": wh.unit_type,
                "connection_secret_id": wh.connection_secret_id
            }
        )
        warehouse_nodes[wh.id] = service_node
        
        await get_or_create_edge(
            None,
            source_node_id=central_node["id"],
            target_node_id=service_node["id"],
            relation_type="HAS_SERVICE"
        )
        
    # 3. Sync SubProjects (Projects)
    res_projects = await db.execute(select(SubProject))
    projects = res_projects.scalars().all()
    
    for proj in projects:
        project_id = f"project_{proj.id}"
        proj_node = await get_or_create_node(
            None,
            node_type="PROJECT",
            entity_id=project_id,
            entity_name=proj.name,
            metadata={
                "description": proj.description,
                "data_role": proj.data_role,
                "data_owner": proj.data_owner,
                "business_kpi_impact": proj.business_kpi_impact
            }
        )
        
        if proj.warehouse_id in warehouse_nodes:
            wh_node = warehouse_nodes[proj.warehouse_id]
            await get_or_create_edge(
                None,
                source_node_id=wh_node["id"],
                target_node_id=proj_node["id"],
                relation_type="HAS_PROJECT"
            )
            
        # 4. Create Database node representing the physical DB schema
        db_id = f"db_{proj.id}_instance"
        db_node = await get_or_create_node(
            None,
            node_type="DATABASE",
            entity_id=db_id,
            entity_name="warehousedb",
            metadata={
                "description": f"Warehouse database schema for project: {proj.name}",
                "why_present": "Holds the master clean datasets and aggregates for business KPI calculation."
            }
        )
        await get_or_create_edge(
            None,
            source_node_id=proj_node["id"],
            target_node_id=db_node["id"],
            relation_type="HAS_DATABASE"
        )
        
        # 5. Fetch TableMetadata for this project
        res_tables = await db.execute(
            select(TableMetadata).where(TableMetadata.sub_project_id == proj.id)
        )
        tables = res_tables.scalars().all()
        
        for table in tables:
            res_attrs = await db.execute(
                select(AttributeMetadata).where(AttributeMetadata.table_id == table.id)
            )
            attrs = res_attrs.scalars().all()
            
            columns_list = []
            for attr in attrs:
                col_str = f"{attr.column_name}: {attr.data_type}"
                if attr.is_required:
                    col_str += " (Required)"
                if attr.is_pii:
                    col_str += " (PII)"
                columns_list.append(col_str)
                
            schema_details = ", ".join(columns_list)
            
            # Storage Unit properties
            metadata = {
                "type": "TABLE",
                "schema_details": schema_details,
                "file_format_type": table.file_format_type,
                "description": table.semantic_description or "No description provided.",
                "why_present": f"Stores clean ingestion results for {table.table_name}.",
                "imp_details": f"Version: {table.version_number}. Aliases: {', '.join(table.aliases or [])}."
            }
            
            table_entity_id = f"tbl-{table.table_name}"
            
            storage_node = await get_or_create_node(
                None,
                node_type="STORAGE_UNIT",
                entity_id=table_entity_id,
                entity_name=table.table_name,
                metadata=metadata
            )
            
            await get_or_create_edge(
                None,
                source_node_id=db_node["id"],
                target_node_id=storage_node["id"],
                relation_type="HAS_STORAGE_UNIT"
            )
            
            # Seed COLUMN nodes to maintain full backwards compatibility
            for attr in attrs:
                col_entity_id = f"col-{table.table_name}-{attr.column_name}"
                col_node = await get_or_create_node(
                    None,
                    node_type="COLUMN",
                    entity_id=col_entity_id,
                    entity_name=attr.column_name,
                    metadata={
                        "is_pii": attr.is_pii,
                        "parent_table": table.table_name,
                        "data_type": attr.data_type,
                        "description": attr.semantic_description
                    }
                )
                await get_or_create_edge(
                    None,
                    source_node_id=col_node["id"],
                    target_node_id=storage_node["id"],
                    relation_type="BELONGS_TO"
                )

    # Let's seed demo graph edges / nodes if empty
    # KPI and Skill nodes can be seeded:
    await get_or_create_node(None, "KPI", "kpi-revenue", "monthly_revenue", {
        "description": "Aggregate revenue calculation used in executive dashboards."
    })
    await get_or_create_node(None, "DASHBOARD", "dash-exec", "Executive Revenue Dashboard", {
        "description": "Real-time executive dashboard showing revenue trends.",
        "refresh_frequency": "hourly"
    })
    
    # We can connect kpi and dashboard to orders table
    # Match order table node:
    res_ord = await neo4j_client.execute_query("MATCH (o:GraphNode {entity_id: 'tbl-orders_clean'}), (k:GraphNode {entity_id: 'kpi-revenue'}), (d:GraphNode {entity_id: 'dash-exec'}) RETURN id(o) AS o_id, id(k) AS k_id, id(d) AS d_id")
    if res_ord:
        o_id = res_ord[0]["o_id"]
        k_id = res_ord[0]["k_id"]
        d_id = res_ord[0]["d_id"]
        if o_id and k_id:
            await get_or_create_edge(None, o_id, k_id, "AFFECTS_KPI", 0.9)
        if d_id and k_id:
            await get_or_create_edge(None, d_id, k_id, "DEPENDS_ON", 0.9)
            
    logger.info("PostgreSQL metadata catalog sync to Neo4j finished successfully!")

# ─────────────────────────────────────────────────────────────────────────────
#  Audit Logs Linkage (PG query)
# ─────────────────────────────────────────────────────────────────────────────

async def get_audit_history_for_node(
    entity_id: str,
    db: AsyncSession,
) -> List[dict]:
    """
    Query PostgreSQL for audit records linked to this Neo4j entity_id.
    """
    from sqlalchemy import select, or_
    from app.models import PipelineSkillsLedger, Proposal, TableMetadata
    
    conditions = [PipelineSkillsLedger.graph_node_id == entity_id]
    
    # Fallback to matching on table name / table_id for backward compatibility
    table_name = None
    if entity_id.startswith("tbl-"):
        table_name = entity_id[4:]
    elif entity_id.startswith("storage_"):
        pass
        
    if table_name:
        tbl_res = await db.execute(
            select(TableMetadata).where(TableMetadata.table_name == table_name)
        )
        tbl = tbl_res.scalars().first()
        if tbl:
            conditions.append(PipelineSkillsLedger.table_id == tbl.id)
            
    stmt = (
        select(PipelineSkillsLedger, Proposal)
        .join(Proposal, PipelineSkillsLedger.proposal_id == Proposal.id, isouter=True)
        .where(or_(*conditions))
        .order_by(PipelineSkillsLedger.executed_at.desc())
    )
    
    res = await db.execute(stmt)
    rows = res.all()
    
    history = []
    for ledger, proposal in rows:
        history.append({
            "id": ledger.id,
            "proposal_id": proposal.id if proposal else "unknown",
            "filename": proposal.filename if proposal else "unknown",
            "skill_name": ledger.skill_name,
            "applied_by_llm_version": ledger.applied_by_llm_version,
            "transformation_script_ref": ledger.transformation_script_ref,
            "human_approver_id": ledger.human_approver_id,
            "execution_status": ledger.execution_status,
            "executed_at": ledger.executed_at.isoformat() if ledger.executed_at else None,
            "graph_node_id": ledger.graph_node_id,
            "llm_prompt_sent": proposal.llm_prompt_sent if proposal else "",
            "llm_raw_response": proposal.llm_raw_response if proposal else "",
        })
    return history
