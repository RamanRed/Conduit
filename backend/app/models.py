from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime

Base = declarative_base()

class WarehouseUnit(Base):
    __tablename__ = "warehouse_units"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    unit_type = Column(String, nullable=False)
    connection_secret_id = Column(String, nullable=False)

class SubProject(Base):
    __tablename__ = "sub_projects"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_id = Column(Integer, ForeignKey("conduit.warehouse_units.id", ondelete="CASCADE"))
    name = Column(String)
    description = Column(String)
    data_role = Column(String, default="PERSISTENT")
    data_owner = Column(String)
    business_kpi_impact = Column(String, nullable=True)

class TableMetadata(Base):
    __tablename__ = "tables_metadata"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    sub_project_id = Column(Integer, ForeignKey("conduit.sub_projects.id", ondelete="CASCADE"))
    table_name = Column(String)
    semantic_description = Column(String)
    storage_location_uri = Column(String)
    file_format_type = Column(String)
    version_number = Column(Integer, default=1)
    aliases = Column(ARRAY(String), default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_mutated_at = Column(DateTime, default=datetime.utcnow)

class AttributeMetadata(Base):
    __tablename__ = "attributes_metadata"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    table_id = Column(Integer, ForeignKey("conduit.tables_metadata.id", ondelete="CASCADE"))
    column_name = Column(String)
    data_type = Column(String)
    semantic_description = Column(String)
    is_required = Column(Boolean, default=False)
    is_pii = Column(Boolean, default=False)
    anomaly_threshold = Column(Float, default=0.05)
    sample_values = Column(ARRAY(String), default=list)

class PipelineSkillsLedger(Base):
    __tablename__ = "pipeline_skills_ledger"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    table_id = Column(Integer, ForeignKey("conduit.tables_metadata.id", ondelete="CASCADE"))
    proposal_id = Column(String, ForeignKey("conduit.proposals.id", ondelete="CASCADE"), nullable=True)
    skill_name = Column(String)
    applied_by_llm_version = Column(String, nullable=True)
    transformation_script_ref = Column(String)
    human_approver_id = Column(String)
    execution_status = Column(String)
    executed_at = Column(DateTime, default=datetime.utcnow)
    graph_node_id = Column(String, nullable=True)


class QuarantineRecord(Base):
    __tablename__ = "quarantine_records"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(String)
    raw_row = Column(JSON)
    failure_reason = Column(String)
    quarantined_at = Column(DateTime, default=datetime.utcnow)

class Proposal(Base):
    __tablename__ = "proposals"
    __table_args__ = {"schema": "conduit"}
    id = Column(String, primary_key=True)
    filename = Column(String)
    gateway_status = Column(String)
    drift_detected = Column(JSON)
    proposed_steps = Column(JSON)
    generated_code = Column(String)
    confidence_score = Column(Float)
    llm_raw_response = Column(String)
    llm_prompt_sent = Column(String)
    status = Column(String)
    human_approver_id = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)
    target_table = Column(String, nullable=True)
    estimated_rows = Column(Integer, nullable=True)
    pii_columns_found = Column(JSON, nullable=True)
    llm_model_used = Column(String, nullable=True)
    description_md = Column(String, nullable=True)
    suggested_skills_to_add = Column(JSON, nullable=True)
    enrichment_applied = Column(JSON, nullable=True)


class InsightRecord(Base):
    __tablename__ = "insight_records"
    __table_args__ = {"schema": "conduit"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(String, ForeignKey("conduit.proposals.id", ondelete="CASCADE"))
    category = Column(String)       # CONCENTRATION | ANOMALY | DATA_QUALITY | TREND | PATTERN
    severity = Column(String)       # INFO | WARNING | CRITICAL
    title = Column(String)
    description = Column(String)
    evidence = Column(JSON)         # Raw statistics backing the insight
    created_at = Column(DateTime, default=datetime.utcnow)
