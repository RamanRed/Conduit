"""
Pydantic schemas for the Conduit extension layer.
These schemas are purely additive — nothing in schemas.py is changed.

Added in this version:
  - CreateGraphNodeRequest / CreateGraphEdgeRequest
  - UpdateSkillRequest
  - AddSkillScriptRequest / AddSkillIssueRequest
  - NeighborDetail / NeighborsResponse
  - ImpactedNode / ImpactAnalysisResponse
  - ProposalContextResponse
  - SkillSearchResponse (alias for list endpoint clarity)
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime


# ─────────────────────────────────────────────────────────────────────────────
#  SKILL REGISTRY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

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


class UpdateSkillRequest(BaseModel):
    """
    Partial update for a skill.  Only provided fields are written —
    omitted fields keep their current value.
    """
    status: Optional[str] = Field(
        default=None,
        description="One of: ACTIVE | DEPRECATED | DRAFT",
    )
    owner: Optional[str] = None
    description: Optional[str] = None
    use_cases: Optional[str] = None
    constraints: Optional[str] = None


class AddSkillScriptRequest(BaseModel):
    script_path: str
    script_hash: Optional[str] = None
    is_validated: bool = True


class AddSkillIssueRequest(BaseModel):
    issue_reference: str
    resolution_notes: Optional[str] = None


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
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SkillDetailResponse(SkillResponse):
    """Skill with its full child records included."""
    scripts: List[Dict[str, Any]] = []
    examples: List[Dict[str, Any]] = []
    issue_references: List[Dict[str, Any]] = []


# ─────────────────────────────────────────────────────────────────────────────
#  GRAPH SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class GraphNodeResponse(BaseModel):
    id: int
    node_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    # validation_alias lets Pydantic read the ORM attribute `node_metadata`
    # but serialise it as `metadata` in JSON output.
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, validation_alias="node_metadata"
    )

    class Config:
        from_attributes = True
        populate_by_name = True   # allow both field name and alias


class GraphEdgeResponse(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    relation_type: Optional[str] = None
    confidence_score: float
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LineageGraphResponse(BaseModel):
    """BFS traversal result: nodes + edges."""
    nodes: List[GraphNodeResponse]
    edges: List[GraphEdgeResponse]


class CreateGraphNodeRequest(BaseModel):
    """Request body for POST /api/graph/nodes."""
    node_type: str = Field(
        ...,
        description="E.g. TABLE | SKILL | KPI | PROJECT | WAREHOUSE | COLUMN | FILE | PIPELINE",
    )
    entity_id: str = Field(
        ...,
        description="Stable unique identifier for this entity (e.g. table name, skill name).",
    )
    entity_name: str = Field(
        ...,
        description="Human-readable display name.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Arbitrary JSONB metadata attached to the node.",
    )


class CreateGraphEdgeRequest(BaseModel):
    """Request body for POST /api/graph/edges."""
    source_node_id: int
    target_node_id: int
    relation_type: str = Field(
        ...,
        description=(
            "One of: BELONGS_TO | DEPENDS_ON | USES_SKILL | FOREIGN_KEY_OF | "
            "AFFECTS_KPI | GENERATED_BY | TRANSFORMS_INTO | MUTATES_VIA | PROTECTED_BY"
        ),
    )
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)


class NeighborDetail(BaseModel):
    """One node adjacent to a queried node, with the connecting edge."""
    direction: str          # "outbound" | "inbound"
    relation_type: Optional[str]
    confidence_score: float
    node: GraphNodeResponse


class NeighborsResponse(BaseModel):
    """All immediate neighbours of a node."""
    node_id: int
    neighbors: List[NeighborDetail]
    total: int


class ImpactedNode(BaseModel):
    """A single node affected by a change to the queried entity."""
    node: GraphNodeResponse
    depth: int              # how many hops from the entity
    relation_type: str      # the edge type that created this dependency
    path: List[str]         # entity names from target → this node


class ImpactAnalysisResponse(BaseModel):
    """
    Full impact analysis result.

    Usage: GET /api/graph/impact/{entity}
    Answers: "If {entity} changes, what else might break?"
    """
    entity: str
    start_nodes: List[GraphNodeResponse]
    impacted_nodes: List[ImpactedNode]
    total_impacted: int


# ─────────────────────────────────────────────────────────────────────────────
#  LINEAGE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
#  PROPOSAL CONTEXT SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class ProposalContextResponse(BaseModel):
    """
    The rich context bundle stored alongside a proposal.
    Phase 1: built at ingest time, stored but not injected into the LLM.
    Phase 2+: will be used to enrich the prompt.
    """
    proposal_id: str
    target_table: Optional[str] = None
    context_bundle: Optional[Dict[str, Any]] = None
    generated_at: datetime

    class Config:
        from_attributes = True
