from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models import TableMetadata, AttributeMetadata, SubProject, WarehouseUnit
from sqlalchemy.future import select

async def get_target_schema(table_name: str, db: AsyncSession) -> dict:
    stmt = select(TableMetadata).where(TableMetadata.table_name == table_name)
    result = await db.execute(stmt)
    table = result.scalars().first()

    if table:
        stmt_attrs = select(AttributeMetadata).where(AttributeMetadata.table_id == table.id)
        result_attrs = await db.execute(stmt_attrs)
        attrs = result_attrs.scalars().all()

        columns = []
        for attr in attrs:
            columns.append({
                "column_name": attr.column_name,
                "data_type": attr.data_type,
                "semantic_description": attr.semantic_description,
                "is_required": attr.is_required,
                "is_pii": attr.is_pii,
                "anomaly_threshold": attr.anomaly_threshold,
                "sample_values": attr.sample_values
            })

        return {
            "table_name": table.table_name,
            "semantic_description": table.semantic_description,
            "columns": columns
        }
    else:
        # Fallback to information_schema
        query = text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :table_name")
        result = await db.execute(query, {"table_name": table_name})
        cols = result.fetchall()
        columns = []
        for c in cols:
            columns.append({
                "column_name": c[0],
                "data_type": c[1],
                "semantic_description": "",
                "is_required": False,
                "is_pii": False,
                "anomaly_threshold": 0.05,
                "sample_values": []
            })
        return {
            "table_name": table_name,
            "semantic_description": "",
            "columns": columns
        }

async def list_registered_tables(db: AsyncSession) -> list[dict]:
    stmt = select(TableMetadata, SubProject, WarehouseUnit).join(SubProject).join(WarehouseUnit)
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for table_md, sp, wu in rows:
        out.append({
            "table_id": table_md.id,
            "table_name": table_md.table_name,
            "warehouse_name": wu.name,
            "sub_project_name": sp.name,
            "data_role": sp.data_role
        })
    return out

async def get_data_distribution(table_name: str, db: AsyncSession) -> dict:
    import re
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$", table_name):
        raise ValueError("Invalid table name")

    # STAGE 6 FIX: Validate table_name is a registered table before using it
    # in dynamic SQL.  This prevents SQL injection even if the regex somehow
    # allows a crafted name through (defence in depth).
    simple_table_name = table_name.split(".")[-1] if "." in table_name else table_name
    stmt_check = select(TableMetadata).where(TableMetadata.table_name == simple_table_name)
    result_check = await db.execute(stmt_check)
    if result_check.scalars().first() is None:
        # Not a registered table — reject the query
        return {}

    try:
        count_query = text(f"SELECT COUNT(*) FROM {table_name}")
        res = await db.execute(count_query)
        row_count = res.scalar()

        col_query = text(f"SELECT column_name FROM information_schema.columns WHERE table_name = :table_name")
        res_cols = await db.execute(col_query, {"table_name": simple_table_name})
        cols = [r[0] for r in res_cols.fetchall()]

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


async def get_all_table_schemas(db: AsyncSession) -> list[dict]:
    stmt = select(TableMetadata)
    result = await db.execute(stmt)
    tables = result.scalars().all()
    
    out = []
    for table in tables:
        stmt_attrs = select(AttributeMetadata).where(AttributeMetadata.table_id == table.id)
        result_attrs = await db.execute(stmt_attrs)
        attrs = result_attrs.scalars().all()
        
        columns = []
        for attr in attrs:
            columns.append({
                "column_name": attr.column_name,
                "data_type": attr.data_type,
                "semantic_description": attr.semantic_description,
                "is_required": attr.is_required,
                "is_pii": attr.is_pii,
                "sample_values": attr.sample_values
            })
            
        out.append({
            "table_name": table.table_name,
            "semantic_description": table.semantic_description,
            "columns": columns
        })
    return out

