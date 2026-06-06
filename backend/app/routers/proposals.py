from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Proposal, PipelineSkillsLedger, TableMetadata
from app.schemas import ProposalResponse, ApproveRequest, RejectRequest, ExecutionResult, DriftItem
from app.services.execution_service import execute_proposal

router = APIRouter()

@router.get("/proposals/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Proposal).where(Proposal.id == proposal_id)
    res = await db.execute(stmt)
    proposal = res.scalars().first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    drift_items = [DriftItem(**item) for item in proposal.drift_detected]
    
    return ProposalResponse(
        proposal_id=proposal.id,
        gateway_status=proposal.gateway_status,
        drift_detected=drift_items,
        proposed_steps=proposal.proposed_steps,
        generated_code=proposal.generated_code,
        confidence_score=proposal.confidence_score,
        pii_columns_found=proposal.pii_columns_found or [],
        estimated_rows=proposal.estimated_rows or 0,
        llm_model_used=proposal.llm_model_used or "llama-3.3-70b-versatile"
    )

@router.post("/proposals/{proposal_id}/approve", response_model=ExecutionResult)
async def approve_proposal(proposal_id: str, req: ApproveRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Proposal).where(Proposal.id == proposal_id)
    res = await db.execute(stmt)
    proposal = res.scalars().first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    return await execute_proposal(proposal, req.human_approver_id, db)

@router.post("/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: str, req: RejectRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Proposal).where(Proposal.id == proposal_id)
    res = await db.execute(stmt)
    proposal = res.scalars().first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    proposal.status = "REJECTED"
    
    stmt = select(TableMetadata).where(TableMetadata.table_name == "orders_clean") # Using mocked table_name for simplicity
    res = await db.execute(stmt)
    tbl = res.scalars().first()
    
    ledger_entry = PipelineSkillsLedger(
        table_id=tbl.id if tbl else None,
        proposal_id=proposal.id,
        skill_name="rejected_by_engineer",
        applied_by_llm_version=None,
        transformation_script_ref=req.reason,
        human_approver_id="system",
        execution_status="FAILED"
    )
    db.add(ledger_entry)
    await db.commit()
    
    return {"status": "rejected"}
