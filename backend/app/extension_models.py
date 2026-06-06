"""
Extension models for Conduit:
  - Skill Registry   (schema: conduit_skills)
  - Relationship Graph (schema: conduit_graph)
  - Data Lineage     (schema: conduit_lineage)

These models are purely additive.  Nothing in this file touches or
imports anything from models.py or any existing router/service.

STAGE 1 FIX: Added UniqueConstraint to GraphNode (node_type, entity_id)
             and GraphEdge (source_node_id, target_node_id, relation_type).
             Without these, ON CONFLICT DO NOTHING in seed SQL does nothing
             useful and get_or_create_* can produce duplicates across restarts.

STAGE 1 FIX: Added UniqueConstraint to SkillIssueReference (skill_id, issue_reference)
             so re-running seed SQL is idempotent.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Text,
    ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base
from datetime import datetime

ExtBase = declarative_base()


# ─────────────────────────────────────────────
#  SKILL REGISTRY  (conduit_skills schema)
# ─────────────────────────────────────────────

class Skill(ExtBase):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("skill_name", name="uq_skill_name"),
        {"schema": "conduit_skills"},
    )

    id          = Column(Integer, primary_key=True, autoincrement=True)
    skill_name  = Column(String(255), nullable=False)
    version     = Column(String(50),  nullable=False)
    category    = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    use_cases   = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)
    owner       = Column(String(255), nullable=True)
    status      = Column(String(50),  default="ACTIVE")
    created_at  = Column(DateTime, default=datetime.utcnow)


class SkillScript(ExtBase):
    __tablename__ = "skill_scripts"
    __table_args__ = (
        UniqueConstraint("skill_id", "script_path", name="uq_skill_script"),
        {"schema": "conduit_skills"},
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    skill_id     = Column(Integer, ForeignKey("conduit_skills.skills.id", ondelete="CASCADE"))
    script_path  = Column(Text, nullable=True)
    script_hash  = Column(Text, nullable=True)
    is_validated = Column(Boolean, default=True)


class SkillExample(ExtBase):
    __tablename__ = "skill_examples"
    __table_args__ = {"schema": "conduit_skills"}

    id             = Column(Integer, primary_key=True, autoincrement=True)
    skill_id       = Column(Integer, ForeignKey("conduit_skills.skills.id", ondelete="CASCADE"))
    input_example  = Column(JSONB, nullable=True)
    output_example = Column(JSONB, nullable=True)


class SkillIssueReference(ExtBase):
    __tablename__ = "skill_issue_references"
    __table_args__ = (
        # Prevents the same incident being linked twice to the same skill
        UniqueConstraint("skill_id", "issue_reference", name="uq_skill_issue_ref"),
        {"schema": "conduit_skills"},
    )

    id               = Column(Integer, primary_key=True, autoincrement=True)
    skill_id         = Column(Integer, ForeignKey("conduit_skills.skills.id", ondelete="CASCADE"))
    issue_reference  = Column(String(255), nullable=True)
    resolution_notes = Column(Text, nullable=True)


# ─────────────────────────────────────────────
#  RELATIONSHIP GRAPH  (conduit_graph schema)
# ─────────────────────────────────────────────

class GraphNode(ExtBase):
    __tablename__ = "graph_nodes"
    __table_args__ = (
        # STAGE 1 FIX: Unique constraint enables ON CONFLICT and prevents duplicate
        # nodes for the same (type, entity_id) pair across container restarts or
        # multiple ingest runs.
        UniqueConstraint("node_type", "entity_id", name="uq_graph_node_type_entity"),
        {"schema": "conduit_graph"},
    )

    id            = Column(Integer, primary_key=True, autoincrement=True)
    node_type     = Column(String(50),  nullable=True)   # TABLE, SKILL, KPI, PROJECT…
    entity_id     = Column(String(255), nullable=True)
    entity_name   = Column(String(255), nullable=True)
    node_metadata = Column("metadata", JSONB, nullable=True)


class GraphEdge(ExtBase):
    __tablename__ = "graph_edges"
    __table_args__ = (
        # STAGE 1 FIX: Prevents duplicate edges of the same type between the same
        # node pair.  get_or_create_edge and ON CONFLICT in seed SQL both rely on
        # this constraint being present.
        UniqueConstraint(
            "source_node_id", "target_node_id", "relation_type",
            name="uq_graph_edge",
        ),
        {"schema": "conduit_graph"},
    )

    id               = Column(Integer, primary_key=True, autoincrement=True)
    source_node_id   = Column(Integer, ForeignKey("conduit_graph.graph_nodes.id", ondelete="CASCADE"))
    target_node_id   = Column(Integer, ForeignKey("conduit_graph.graph_nodes.id", ondelete="CASCADE"))
    relation_type    = Column(String(100), nullable=True)
    confidence_score = Column(Float, default=1.0)
    created_at       = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
#  DATA LINEAGE  (conduit_lineage schema)
# ─────────────────────────────────────────────

class LineageEvent(ExtBase):
    __tablename__ = "lineage_events"
    __table_args__ = {"schema": "conduit_lineage"}

    id             = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id    = Column(String(255), nullable=True)
    source_entity  = Column(String(255), nullable=True)
    target_entity  = Column(String(255), nullable=True)
    operation_type = Column(String(255), nullable=True)
    skill_used     = Column(String(255), nullable=True)
    executed_at    = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
#  PROPOSAL CONTEXT  (conduit_skills schema)
#  Stores the context bundle built during ingest.
#  Phase 1 — built and stored, not yet injected.
#  Phase 2 — bundle will be injected into AI prompt.
# ─────────────────────────────────────────────

class ProposalContext(ExtBase):
    __tablename__ = "proposal_contexts"
    __table_args__ = (
        UniqueConstraint("proposal_id", name="uq_proposal_context_proposal_id"),
        {"schema": "conduit_skills"},
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id    = Column(String(255), nullable=False)
    target_table   = Column(String(255), nullable=True)
    context_bundle = Column(JSONB, nullable=True)
    generated_at   = Column(DateTime, default=datetime.utcnow)
