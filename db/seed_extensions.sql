-- =============================================================
--  Conduit Extension Seed Data
--  Creates sample Skill Registry + Relationship Graph entries
--  for demo purposes.
--  Run AFTER the main seed_warehouse.sql.
--  Safe to re-run (uses INSERT ... ON CONFLICT ... DO NOTHING).
--
--  STAGE 8 FIX: Updated ON CONFLICT clauses to reference the
--  correct named constraints created by Stage 1.
--  Also added COLUMN PII nodes and DASHBOARD node for Phase 2.
-- =============================================================

-- ─────────────────────────────────────────────
--  SKILL REGISTRY
-- ─────────────────────────────────────────────

INSERT INTO conduit_skills.skills
  (skill_name, version, category, description, use_cases, constraints, owner, status)
VALUES
  ('pii_masking', '1.0.0', 'SECURITY',
   'Hashes PII columns (email, phone, SSN) using SHA-256 to protect customer data.',
   'Any dataset containing customer contact information or government IDs.',
   'Column must be non-null and string type. Hash is one-way — original value cannot be recovered.',
   'Data Engineering Team', 'ACTIVE'),

  ('rename_column', '1.0.0', 'SCHEMA_EVOLUTION',
   'Renames one or more columns to match the target schema standard names.',
   'Supplier feeds with non-standard column names, legacy system exports.',
   'Source and target column data types must be compatible.',
   'Data Engineering Team', 'ACTIVE'),

  ('fill_nulls', '1.0.0', 'DATA_CLEANING',
   'Fills null values in specified columns with a default value or forward-fill strategy.',
   'Order status fields, categorical columns with known default values.',
   'Default value must match column data type. Never fills primary key columns.',
   'Data Engineering Team', 'ACTIVE'),

  ('type_conversion', '1.0.0', 'SCHEMA_EVOLUTION',
   'Converts column data types (e.g. string → integer, string → timestamp).',
   'CSV uploads where all values arrive as strings.',
   'Conversion must be lossless. Raises on data that cannot be converted.',
   'Data Engineering Team', 'ACTIVE'),

  ('deduplicate_records', '1.0.0', 'DATA_CLEANING',
   'Removes duplicate rows based on a primary key or composite key.',
   'CRM imports, external API responses with repeated entries.',
   'Primary key column must be specified. Keeps the last seen record by default.',
   'Data Engineering Team', 'ACTIVE'),

  ('drop_extra_columns', '1.0.0', 'SCHEMA_EVOLUTION',
   'Removes columns present in the incoming data that do not exist in the target schema.',
   'Any ingestion where the source has more columns than the target.',
   'Only drops columns not in the target schema. Never drops required columns.',
   'Data Engineering Team', 'ACTIVE')
ON CONFLICT ON CONSTRAINT uq_skill_name DO NOTHING;

-- Skill examples
INSERT INTO conduit_skills.skill_examples (skill_id, input_example, output_example)
SELECT s.id,
  '{"customer_email": "john@example.com"}'::jsonb,
  '{"customer_email": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"}'::jsonb
FROM conduit_skills.skills s WHERE s.skill_name = 'pii_masking'
ON CONFLICT DO NOTHING;

INSERT INTO conduit_skills.skill_examples (skill_id, input_example, output_example)
SELECT s.id,
  '{"order_amount": 49.99}'::jsonb,
  '{"amount_usd": 49.99}'::jsonb
FROM conduit_skills.skills s WHERE s.skill_name = 'rename_column'
ON CONFLICT DO NOTHING;

-- Skill issue references
INSERT INTO conduit_skills.skill_issue_references (skill_id, issue_reference, resolution_notes)
SELECT s.id, 'INC-101', 'Customer emails with Unicode characters failed SHA-256. Fixed by encoding to UTF-8 first.'
FROM conduit_skills.skills s WHERE s.skill_name = 'pii_masking'
ON CONFLICT ON CONSTRAINT uq_skill_issue_ref DO NOTHING;


-- ─────────────────────────────────────────────
--  RELATIONSHIP GRAPH
-- ─────────────────────────────────────────────

-- Nodes (original + Phase 2 additions)
INSERT INTO conduit_graph.graph_nodes (node_type, entity_id, entity_name, metadata)
VALUES
  ('WAREHOUSE', 'wh-1', 'Production_Warehouse_PG',
   '{"unit_type": "POSTGRES"}'::jsonb),

  ('PROJECT', 'proj-1', 'E-Commerce Core',
   '{"data_owner": "Data Engineering Team", "business_kpi_impact": "Directly feeds monthly revenue dashboard and customer LTV calculations"}'::jsonb),

  ('TABLE', 'tbl-orders', 'orders_clean',
   '{"semantic_description": "Cleaned and validated order records from all sales channels."}'::jsonb),

  ('TABLE', 'tbl-customers', 'customers',
   '{"semantic_description": "Master customer record table used by all order pipelines."}'::jsonb),

  ('KPI', 'kpi-revenue', 'monthly_revenue',
   '{"description": "Aggregate revenue calculation used in executive dashboards."}'::jsonb),

  ('SKILL', 'skill-pii', 'pii_masking',
   '{"category": "SECURITY"}'::jsonb),

  ('SKILL', 'skill-rename', 'rename_column',
   '{"category": "SCHEMA_EVOLUTION"}'::jsonb),

  -- STAGE 8 Phase 2 additions: COLUMN nodes with PII flags
  ('COLUMN', 'col-customer-email', 'customer_email',
   '{"is_pii": true, "parent_table": "orders_clean", "data_type": "string"}'::jsonb),

  ('COLUMN', 'col-order-id', 'order_id',
   '{"is_pii": false, "parent_table": "orders_clean", "data_type": "integer"}'::jsonb),

  -- STAGE 8 Phase 2 addition: DASHBOARD node
  ('DASHBOARD', 'dash-exec', 'Executive Revenue Dashboard',
   '{"description": "Real-time executive dashboard showing revenue trends, customer acquisition, and order volume.", "refresh_frequency": "hourly"}'::jsonb)

ON CONFLICT ON CONSTRAINT uq_graph_node_type_entity DO NOTHING;

-- Edges — relationship graph (STAGE 8 FIX: use named constraint)
INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'BELONGS_TO', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'proj-1' AND t.entity_id = 'wh-1'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'BELONGS_TO', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'tbl-orders' AND t.entity_id = 'proj-1'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'DEPENDS_ON', 0.95
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'tbl-orders' AND t.entity_id = 'tbl-customers'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'AFFECTS_KPI', 0.9
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'tbl-orders' AND t.entity_id = 'kpi-revenue'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'USES_SKILL', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'tbl-orders' AND t.entity_id = 'skill-pii'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'USES_SKILL', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'tbl-orders' AND t.entity_id = 'skill-rename'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

-- STAGE 8 Phase 2: COLUMN belongs to TABLE edges
INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'BELONGS_TO', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'col-customer-email' AND t.entity_id = 'tbl-orders'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'BELONGS_TO', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'col-order-id' AND t.entity_id = 'tbl-orders'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

-- STAGE 8 Phase 2: customer_email PROTECTED_BY pii_masking skill
INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'PROTECTED_BY', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'col-customer-email' AND t.entity_id = 'skill-pii'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;

-- STAGE 8 Phase 2: DASHBOARD depends on KPI
INSERT INTO conduit_graph.graph_edges (source_node_id, target_node_id, relation_type, confidence_score)
SELECT s.id, t.id, 'DEPENDS_ON', 0.9
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'dash-exec' AND t.entity_id = 'kpi-revenue'
ON CONFLICT ON CONSTRAINT uq_graph_edge DO NOTHING;
