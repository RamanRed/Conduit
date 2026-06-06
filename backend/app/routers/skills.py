"""
Skills API router — additive endpoints only.
Existing /api/* routes are NOT touched.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.extension_schemas import CreateSkillRequest, SkillResponse, SkillDetailResponse
from app.services import skill_registry_service

router = APIRouter()


@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all registered skills with optional filters."""
    skills = await skill_registry_service.list_skills(
        db, category=category, status=status, limit=limit, offset=offset
    )
    return [SkillResponse.model_validate(s) for s in skills]


@router.get("/skills/{skill_id}", response_model=SkillDetailResponse)
async def get_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    """Get a skill with all its scripts, examples, and issue references."""
    data = await skill_registry_service.get_skill_with_children(db, skill_id)
    if not data:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill = data["skill"]
    return SkillDetailResponse(
        id=skill.id,
        skill_name=skill.skill_name,
        version=skill.version,
        category=skill.category,
        description=skill.description,
        use_cases=skill.use_cases,
        constraints=skill.constraints,
        owner=skill.owner,
        status=skill.status,
        created_at=skill.created_at,
        scripts=[
            {"id": s.id, "script_path": s.script_path, "script_hash": s.script_hash, "is_validated": s.is_validated}
            for s in data["scripts"]
        ],
        examples=[
            {"id": e.id, "input_example": e.input_example, "output_example": e.output_example}
            for e in data["examples"]
        ],
        issue_references=[
            {"id": r.id, "issue_reference": r.issue_reference, "resolution_notes": r.resolution_notes}
            for r in data["issue_references"]
        ],
    )


@router.post("/skills", response_model=SkillResponse, status_code=201)
async def create_skill(req: CreateSkillRequest, db: AsyncSession = Depends(get_db)):
    """Register a new skill in the registry."""
    try:
        skill = await skill_registry_service.register_skill(
            db=db,
            skill_name=req.skill_name,
            version=req.version,
            category=req.category,
            description=req.description,
            use_cases=req.use_cases,
            constraints=req.constraints,
            owner=req.owner,
            examples=[{"input": e.input, "output": e.output} for e in (req.examples or [])],
            issue_references=[{"reference": r.reference, "notes": r.notes} for r in (req.issue_references or [])],
        )
        return SkillResponse.model_validate(skill)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
