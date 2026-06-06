"""
Skill Registry Service
Responsibilities: register, retrieve, list, and search skills.
All operations are purely additive — this service never touches
any table in the conduit schema.
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.extension_models import Skill, SkillScript, SkillExample, SkillIssueReference


async def register_skill(
    db: AsyncSession,
    skill_name: str,
    version: str,
    category: str,
    description: str,
    use_cases: Optional[str] = None,
    constraints: Optional[str] = None,
    owner: Optional[str] = None,
    examples: Optional[List[dict]] = None,
    issue_references: Optional[List[dict]] = None,
) -> Skill:
    """
    Create a new skill record and optional child records.
    Returns the persisted Skill ORM object.
    """
    skill = Skill(
        skill_name=skill_name,
        version=version,
        category=category,
        description=description,
        use_cases=use_cases,
        constraints=constraints,
        owner=owner,
    )
    db.add(skill)
    await db.flush()  # get skill.id without full commit

    if examples:
        for ex in examples:
            db.add(SkillExample(
                skill_id=skill.id,
                input_example=ex.get("input"),
                output_example=ex.get("output"),
            ))

    if issue_references:
        for ref in issue_references:
            db.add(SkillIssueReference(
                skill_id=skill.id,
                issue_reference=ref.get("reference"),
                resolution_notes=ref.get("notes"),
            ))

    await db.commit()
    await db.refresh(skill)
    return skill


async def get_skill(db: AsyncSession, skill_id: int) -> Optional[Skill]:
    """Fetch a single skill by primary key."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    return result.scalars().first()


async def get_skill_with_children(db: AsyncSession, skill_id: int) -> dict:
    """
    Return a skill along with its scripts, examples, and issue references.
    """
    skill = await get_skill(db, skill_id)
    if not skill:
        return {}

    scripts_res = await db.execute(
        select(SkillScript).where(SkillScript.skill_id == skill_id)
    )
    examples_res = await db.execute(
        select(SkillExample).where(SkillExample.skill_id == skill_id)
    )
    issues_res = await db.execute(
        select(SkillIssueReference).where(SkillIssueReference.skill_id == skill_id)
    )

    return {
        "skill": skill,
        "scripts": scripts_res.scalars().all(),
        "examples": examples_res.scalars().all(),
        "issue_references": issues_res.scalars().all(),
    }


async def list_skills(
    db: AsyncSession,
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Skill]:
    """List all skills with optional filters."""
    stmt = select(Skill)
    if category:
        stmt = stmt.where(Skill.category == category)
    if status:
        stmt = stmt.where(Skill.status == status)
    stmt = stmt.order_by(Skill.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def find_matching_skills(
    db: AsyncSession,
    keywords: List[str],
    limit: int = 10,
) -> List[Skill]:
    """
    Simple keyword search across skill_name, description, and use_cases.
    Used by the context retrieval layer to surface relevant skills
    for an incoming dataset.
    """
    if not keywords:
        return []

    filters = []
    for kw in keywords:
        kw_like = f"%{kw}%"
        filters.append(Skill.skill_name.ilike(kw_like))
        filters.append(Skill.description.ilike(kw_like))
        filters.append(Skill.use_cases.ilike(kw_like))

    stmt = (
        select(Skill)
        .where(or_(*filters))
        .where(Skill.status == "ACTIVE")
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
