"""
Schema service — reads target-table knowledge from Neo4j (AI graph).

PostgreSQL is NOT used for schema/catalog metadata anymore.
Live row statistics still query the warehouse DB directly.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.services import graph_knowledge_service


async def get_target_schema(table_name: str, db: AsyncSession = None) -> dict:
    """Fetch target schema from the Neo4j knowledge graph."""
    try:
        return await graph_knowledge_service.get_target_schema(table_name)
    except RuntimeError:
        # Neo4j down — last-resort empty schema (ingest will CONFLICT)
        return {"table_name": table_name, "semantic_description": "", "columns": []}


async def list_registered_tables(db: AsyncSession = None) -> list[dict]:
    try:
        return await graph_knowledge_service.list_registered_tables()
    except RuntimeError:
        return []


async def get_data_distribution(table_name: str, db: AsyncSession) -> dict:
    import re
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$", table_name):
        raise ValueError("Invalid table name")

    simple_table_name = table_name.split(".")[-1] if "." in table_name else table_name

    # Verify table is known to the knowledge graph
    try:
        schema = await graph_knowledge_service.get_target_schema(simple_table_name)
        if not schema.get("columns"):
            return {}
    except RuntimeError:
        return {}

    try:
        count_query = text(f"SELECT COUNT(*) FROM {table_name}")
        res = await db.execute(count_query)
        row_count = res.scalar()

        cols = [c["column_name"] for c in schema["columns"]]

        columns = []
        for c in cols:
            if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", c):
                continue

            null_query = text(f"SELECT COUNT(*) - COUNT({c}) as nulls FROM {table_name}")
            res_null = await db.execute(null_query)
            null_count = res_null.scalar()

            dist_query = text(f"SELECT COUNT(DISTINCT {c}) FROM {table_name}")
            res_dist = await db.execute(dist_query)
            distinct_count = res_dist.scalar()

            columns.append({
                "column_name": c,
                "null_count": null_count,
                "null_ratio": null_count / row_count if row_count > 0 else 0,
                "distinct_count": distinct_count
            })

        return {
            "table_name": table_name,
            "row_count": row_count,
            "columns": columns
        }
    except Exception:
        return {}


async def get_all_table_schemas(db: AsyncSession = None) -> list[dict]:
    try:
        return await graph_knowledge_service.get_all_table_schemas()
    except RuntimeError:
        return []
