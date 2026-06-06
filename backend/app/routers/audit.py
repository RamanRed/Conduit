from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Proposal, PipelineSkillsLedger
from app.schemas import AuditEntry
from typing import List

router = APIRouter()

@router.get("/audit", response_model=List[AuditEntry])
async def get_audit(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    # Simple join, we will fetch ledger and then proposal for missing fields (filename, llm_prompt)
    stmt = select(PipelineSkillsLedger, Proposal).join(Proposal, PipelineSkillsLedger.transformation_script_ref == Proposal.generated_code, isouter=True).order_by(PipelineSkillsLedger.executed_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    rows = res.all()
    
    entries = []
    for ledger, proposal in rows:
        entries.append(AuditEntry(
            id=ledger.id,
            proposal_id=proposal.id if proposal else "unknown",
            filename=proposal.filename if proposal else "unknown",
            skill_name=ledger.skill_name,
            execution_status=ledger.execution_status,
            human_approver_id=ledger.human_approver_id,
            executed_at=ledger.executed_at,
            llm_prompt_sent=proposal.llm_prompt_sent if proposal else "",
            llm_raw_response=proposal.llm_raw_response if proposal else "",
            transformation_script_ref=ledger.transformation_script_ref
        ))
    return entries

@router.get("/audit/{entry_id}", response_model=AuditEntry)
async def get_audit_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(PipelineSkillsLedger).where(PipelineSkillsLedger.id == entry_id)
    res = await db.execute(stmt)
    ledger = res.scalars().first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    stmt_p = select(Proposal).where(Proposal.generated_code == ledger.transformation_script_ref)
    res_p = await db.execute(stmt_p)
    proposal = res_p.scalars().first()
    
    return AuditEntry(
        id=ledger.id,
        proposal_id=proposal.id if proposal else "unknown",
        filename=proposal.filename if proposal else "unknown",
        skill_name=ledger.skill_name,
        execution_status=ledger.execution_status,
        human_approver_id=ledger.human_approver_id,
        executed_at=ledger.executed_at,
        llm_prompt_sent=proposal.llm_prompt_sent if proposal else "",
        llm_raw_response=proposal.llm_raw_response if proposal else "",
        transformation_script_ref=ledger.transformation_script_ref
    )
