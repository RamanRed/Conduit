"""
Pydantic schemas for the Conduit extension layer.
These schemas are purely additive — nothing in schemas.py is changed.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime


# ─────────────────────────────────────────────
#  SKILL REGISTRY SCHEMAS
# ─────────────────────────────────────────────

class SkillExampleSchema(BaseModel):
    input: Optional[Any] = None
    output: Optional[Any] = None

    class Config:
        from_attributes = True


class SkillIssueRefSchema(BaseModel):
    reference: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CreateSkillRequest(BaseModel):
    skill_name: str
    version: str = "1.0.0"
    category: str
    description: str
    use_cases: Optional[str] = None
    constraints: Optional[str] = None
    owner: Optional[str] = None
    examples: Optional[List[SkillExampleSchema]] = None
    issue_references: Optional[List[SkillIssueRefSchema]] = None


class SkillResponse(BaseModel):
    id: int
    skill_name: str
    version: str
    category: str
    description: str
    use_cases: Optional[str] = None
    constraints: Optional[str] = None
    owner: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SkillDetailResponse(SkillResponse):
    scripts: List[Dict[str, Any]] = []
    examples: List[Dict[str, Any]] = []
    issue_references: List[Dict[str, Any]] = []


# ─────────────────────────────────────────────
#  GRAPH SCHEMAS
# ─────────────────────────────────────────────

class GraphNodeResponse(BaseModel):
    id: int
    node_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default=None, validation_alias="node_metadata")

    class Config:
        from_attributes = True


class GraphEdgeResponse(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    relation_type: Optional[str] = None
    confidence_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class LineageGraphResponse(BaseModel):
    nodes: List[GraphNodeResponse]
    edges: List[GraphEdgeResponse]


# ─────────────────────────────────────────────
#  LINEAGE SCHEMAS
# ─────────────────────────────────────────────

class LineageEventResponse(BaseModel):
    id: int
    proposal_id: Optional[str] = None
    source_entity: Optional[str] = None
    target_entity: Optional[str] = None
    operation_type: Optional[str] = None
    skill_used: Optional[str] = None
    executed_at: datetime

    class Config:
        from_attributes = True
