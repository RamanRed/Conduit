from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
import pandas as pd
from datetime import datetime
from app.models import Proposal, PipelineSkillsLedger, QuarantineRecord, TableMetadata
from app.schemas import ExecutionResult

async def execute_proposal(
    proposal: Proposal,
    approver_id: str,
    db: AsyncSession
) -> ExecutionResult:
    if proposal.status != "PENDING":
        raise ValueError(f"Proposal is {proposal.status}, not PENDING")

    proposal.status = "APPROVED"
    proposal.human_approver_id = approver_id
    proposal.approved_at = datetime.utcnow()
    await db.commit()

    filepath = proposal.file_path
    try:
        df = pd.read_csv(filepath)
    except Exception as e:
        proposal.status = "FAILED"
        await db.commit()
        raise e

    import hashlib
    namespace = {"pd": pd, "df": df, "hashlib": hashlib}
    try:
        exec(proposal.generated_code, namespace)
        transform_fn = namespace["transform"]
        transformed_df = transform_fn(df)
    except Exception as e:
        proposal.status = "FAILED"
        stmt = select(TableMetadata).where(TableMetadata.table_name == "orders_clean")
        res = await db.execute(stmt)
        tbl = res.scalars().first()
        ledger_entry = PipelineSkillsLedger(
            table_id=tbl.id if tbl else None,
            proposal_id=proposal.id,
            skill_name=f"transform_{proposal.filename}",
            applied_by_llm_version=proposal.llm_model_used or "llama-3.3-70b-versatile",
            transformation_script_ref=proposal.generated_code,
            human_approver_id=approver_id,
            execution_status="FAILED"
        )
        db.add(ledger_entry)
        await db.commit()
        raise e

    # Insert into database
    stmt = select(TableMetadata).where(TableMetadata.table_name == "orders_clean")
    res = await db.execute(stmt)
    tbl = res.scalars().first()
    table_name = "orders_clean" # Hardcoded for demo, could parse from proposal

    rows_written = 0
    rows_quarantined = 0
    start_time = datetime.now()

    cols = transformed_df.columns.tolist()
    placeholders = ", ".join([f":{c}" for c in cols])
    insert_sql = text(f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES ({placeholders})")

    for row in transformed_df.to_dict('records'):
        clean_row = {}
        for k, v in row.items():
            if pd.isna(v):
                clean_row[k] = None
            elif isinstance(v, pd.Timestamp):
                clean_row[k] = v.to_pydatetime()
            else:
                clean_row[k] = v
        try:
            async with db.begin_nested():
                await db.execute(insert_sql, clean_row)
                rows_written += 1
        except Exception as e:
            qr_row = {k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in clean_row.items()}
            # Failed to insert, write quarantine
            qr = QuarantineRecord(
                proposal_id=proposal.id,
                raw_row=qr_row,
                failure_reason=str(e)
            )
            db.add(qr)
            rows_quarantined += 1

    try:
        ledger_status = "SUCCESS" if rows_written > 0 else "FAILED"
        ledger_entry = PipelineSkillsLedger(
            table_id=tbl.id if tbl else None,
            proposal_id=proposal.id,
            skill_name=f"transform_{proposal.filename}",
            applied_by_llm_version=proposal.llm_model_used or "llama-3.3-70b-versatile",
            transformation_script_ref=proposal.generated_code,
            human_approver_id=approver_id,
            execution_status=ledger_status
        )
        db.add(ledger_entry)
        proposal.status = "EXECUTED"
        await db.commit()
    except Exception as e:
        await db.rollback()
        proposal.status = "FAILED"
        db.add(PipelineSkillsLedger(
            table_id=tbl.id if tbl else None,
            proposal_id=proposal.id,
            skill_name=f"transform_{proposal.filename}",
            applied_by_llm_version=proposal.llm_model_used or "llama-3.3-70b-versatile",
            transformation_script_ref=proposal.generated_code,
            human_approver_id=approver_id,
            execution_status="ROLLEDBACK"
        ))
        await db.commit()
        raise e

    duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

    return ExecutionResult(
        proposal_id=proposal.id,
        rows_written=rows_written,
        rows_quarantined=rows_quarantined,
        execution_status="SUCCESS" if rows_written > 0 else "FAILED",
        duration_ms=duration_ms
    )
