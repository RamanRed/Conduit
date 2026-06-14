/**
 * Mock data for Vercel demo deployment.
 * All data is derived from the actual SQL seeds (seed_warehouse.sql, seed_extensions.sql)
 * and the demo CSV files to provide a realistic experience.
 */

import type {
  AuditEntry,
  ExecutionResult,
  GraphEdgeResponse,
  GraphNodeResponse,
  ImpactAnalysisResponse,
  InsightItem,
  LineageEventResponse,
  LineageGraphResponse,
  NeighborsResponse,
  ProposalContextResponse,
  ProposalResponse,
  QuarantineEntry,
  SkillDetailResponse,
  SkillResponse,
  SuggestTargetResponse,
  WarehouseUnitResponse,
} from "./types";

/* ─── Helpers ──────────────────────────────────────────────── */

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400_000).toISOString();
}

/* ─── Proposals ────────────────────────────────────────────── */

export const MOCK_PROPOSALS: ProposalResponse[] = [
  {
    proposal_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    gateway_status: "AUTO_LINK",
    target_table: "orders_clean",
    drift_detected: [],
    proposed_steps: [
      "Verify column types match target schema",
      "Pass-through: all columns aligned",
    ],
    generated_code: `import pandas as pd

def transform(df: pd.DataFrame) -> pd.DataFrame:
    """No drift detected — pass-through transformation."""
    # Ensure column order matches target schema
    target_columns = [
        "order_id", "customer_id", "amount_usd",
        "order_status", "customer_email", "created_at", "processed_at"
    ]
    df = df[target_columns]
    
    # Type enforcement
    df["order_id"] = df["order_id"].astype(int)
    df["customer_id"] = df["customer_id"].astype(int)
    df["amount_usd"] = pd.to_numeric(df["amount_usd"])
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["processed_at"] = pd.to_datetime(df["processed_at"], errors="coerce")
    
    return df`,
    confidence_score: 0.98,
    pii_columns_found: ["customer_email"],
    estimated_rows: 25,
    llm_model_used: "llama-3.3-70b-versatile",
    reasoning: "All columns in the incoming CSV match the target schema exactly. Column types are compatible. No renaming, null-filling, or type conversion needed. The data can be auto-linked directly.",
    reasoning_note: null,
    description_md: "Clean orders CSV with exact schema match to target table.",
    suggested_skills_to_add: null,
    enrichment_applied: ["pii_detection"],
  },
  {
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    gateway_status: "SCHEMA_EVOLUTION",
    target_table: "orders_clean",
    drift_detected: [
      {
        column: "order_amount",
        issue_type: "RENAME",
        source_value: "order_amount",
        target_expectation: "amount_usd",
        suggested_action: "Rename order_amount → amount_usd",
        severity: "MEDIUM",
      },
      {
        column: "order_status",
        issue_type: "NULL_VIOLATION",
        source_value: "3 null values",
        target_expectation: "Non-null required",
        suggested_action: "Fill nulls with 'pending'",
        severity: "MEDIUM",
      },
      {
        column: "discount_code",
        issue_type: "EXTRA_COLUMN",
        source_value: "discount_code",
        target_expectation: "Not in target schema",
        suggested_action: "Drop column",
        severity: "LOW",
      },
    ],
    proposed_steps: [
      "Rename 'order_amount' to 'amount_usd'",
      "Fill null values in 'order_status' with 'pending'",
      "Drop extra column 'discount_code'",
      "Hash PII column 'customer_email' with SHA-256",
      "Enforce column types",
    ],
    generated_code: `import pandas as pd
import hashlib

def transform(df: pd.DataFrame) -> pd.DataFrame:
    """Schema evolution: rename, null-fill, drop extra, mask PII."""
    # Step 1: Rename drifted columns
    df = df.rename(columns={"order_amount": "amount_usd"})
    
    # Step 2: Fill null violations
    df["order_status"] = df["order_status"].fillna("pending")
    
    # Step 3: Drop extra columns not in target schema
    df = df.drop(columns=["discount_code"], errors="ignore")
    
    # Step 4: PII masking — hash customer_email
    df["customer_email"] = df["customer_email"].apply(
        lambda x: hashlib.sha256(str(x).encode("utf-8")).hexdigest()
        if pd.notna(x) else None
    )
    
    # Step 5: Enforce column types
    df["order_id"] = df["order_id"].astype(int)
    df["customer_id"] = df["customer_id"].astype(int)
    df["amount_usd"] = pd.to_numeric(df["amount_usd"])
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["processed_at"] = pd.to_datetime(df["processed_at"], errors="coerce")
    
    target_columns = [
        "order_id", "customer_id", "amount_usd",
        "order_status", "customer_email", "created_at", "processed_at"
    ]
    return df[target_columns]`,
    confidence_score: 0.85,
    pii_columns_found: ["customer_email"],
    estimated_rows: 20,
    llm_model_used: "llama-3.3-70b-versatile",
    reasoning: "Three drift items detected: (1) column rename order_amount→amount_usd matches a known pattern, (2) null values in order_status can be safely filled with the default 'pending', (3) extra column discount_code is not in the target and should be dropped. PII column customer_email detected and will be SHA-256 hashed.",
    reasoning_note: null,
    description_md: "Drifted orders with renamed columns, null violations, and extra columns.",
    suggested_skills_to_add: [
      {
        skill_name: "currency_normalization",
        description: "Normalize currency amounts from various supplier formats to a standard USD decimal",
        category: "DATA_CLEANING",
      },
    ],
    enrichment_applied: ["pii_detection", "skill_matching", "graph_context"],
  },
  {
    proposal_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    gateway_status: "AUTO_LINK",
    target_table: "orders_clean",
    drift_detected: [],
    proposed_steps: [
      "Verify schema alignment",
      "Auto-link: no transformation required",
    ],
    generated_code: `import pandas as pd

def transform(df: pd.DataFrame) -> pd.DataFrame:
    """Auto-link: schema matches perfectly."""
    target_columns = [
        "order_id", "customer_id", "amount_usd",
        "order_status", "customer_email", "created_at", "processed_at"
    ]
    return df[target_columns]`,
    confidence_score: 0.99,
    pii_columns_found: ["customer_email"],
    estimated_rows: 50,
    llm_model_used: "llama-3.3-70b-versatile",
    reasoning: "Perfect schema alignment. All columns present with matching types.",
    reasoning_note: null,
    description_md: null,
    suggested_skills_to_add: null,
    enrichment_applied: ["pii_detection"],
  },
  {
    proposal_id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    gateway_status: "SCHEMA_EVOLUTION",
    target_table: "orders_clean",
    drift_detected: [
      {
        column: "total_amount",
        issue_type: "RENAME",
        source_value: "total_amount",
        target_expectation: "amount_usd",
        suggested_action: "Rename total_amount → amount_usd",
        severity: "MEDIUM",
      },
      {
        column: "email",
        issue_type: "RENAME",
        source_value: "email",
        target_expectation: "customer_email",
        suggested_action: "Rename email → customer_email",
        severity: "MEDIUM",
      },
    ],
    proposed_steps: [
      "Rename 'total_amount' to 'amount_usd'",
      "Rename 'email' to 'customer_email'",
      "Enforce column types",
    ],
    generated_code: `import pandas as pd

def transform(df: pd.DataFrame) -> pd.DataFrame:
    """Schema evolution: column renames."""
    df = df.rename(columns={
        "total_amount": "amount_usd",
        "email": "customer_email"
    })
    
    df["order_id"] = df["order_id"].astype(int)
    df["customer_id"] = df["customer_id"].astype(int)
    df["amount_usd"] = pd.to_numeric(df["amount_usd"])
    
    target_columns = [
        "order_id", "customer_id", "amount_usd",
        "order_status", "customer_email", "created_at", "processed_at"
    ]
    return df[target_columns]`,
    confidence_score: 0.91,
    pii_columns_found: ["email"],
    estimated_rows: 35,
    llm_model_used: "llama-3.3-70b-versatile",
    reasoning: "Two column renames detected. 'total_amount' maps to 'amount_usd' based on semantic similarity and value distribution analysis. 'email' maps to 'customer_email' — both contain valid email patterns.",
    reasoning_note: null,
    description_md: "Supplier export with non-standard column naming convention.",
    suggested_skills_to_add: null,
    enrichment_applied: ["pii_detection", "skill_matching"],
  },
  {
    proposal_id: "e5f6a7b8-c9d0-1234-efab-345678901234",
    gateway_status: "CONFLICT",
    target_table: "orders_clean",
    drift_detected: [
      {
        column: "order_id",
        issue_type: "TYPE_MISMATCH",
        source_value: "VARCHAR (e.g. 'ORD-1001')",
        target_expectation: "INT",
        suggested_action: "Cannot safely convert — alphanumeric IDs",
        severity: "HIGH",
      },
      {
        column: "amount_usd",
        issue_type: "MISSING_REQUIRED",
        source_value: "Column not present",
        target_expectation: "Required DECIMAL column",
        suggested_action: "No equivalent column found in source",
        severity: "HIGH",
      },
      {
        column: "order_total",
        issue_type: "TYPE_MISMATCH",
        source_value: "VARCHAR (e.g. '$49.99')",
        target_expectation: "DECIMAL",
        suggested_action: "Currency symbol prevents direct cast",
        severity: "HIGH",
      },
    ],
    proposed_steps: [
      "BLOCKED: order_id type mismatch (VARCHAR → INT) is not safely convertible",
      "BLOCKED: amount_usd is missing and no direct substitute found",
      "BLOCKED: order_total contains currency symbols preventing numeric cast",
    ],
    generated_code: `# CONFLICT — No safe transformation possible.
# 
# Critical issues:
# 1. order_id contains alphanumeric values (e.g. 'ORD-1001') that cannot 
#    be cast to INT without data loss.
# 2. amount_usd is missing from the source entirely.
# 3. order_total contains currency symbols ('$49.99') that prevent 
#    direct numeric conversion.
#
# Human intervention required to resolve these structural incompatibilities.
raise ValueError("CONFLICT: Cannot generate safe transformation. See drift report.")`,
    confidence_score: 0.25,
    pii_columns_found: [],
    estimated_rows: 15,
    llm_model_used: "llama-3.3-70b-versatile",
    reasoning: "Multiple critical incompatibilities detected. The source schema is structurally incompatible with the target. order_id uses alphanumeric identifiers that cannot be safely converted to integers. The required amount_usd column has no direct equivalent. Manual restructuring is required.",
    reasoning_note: "Gateway override: forced to CONFLICT due to critical TYPE_MISMATCH and MISSING_REQUIRED issues.",
    description_md: "Legacy system export with incompatible schema structure.",
    suggested_skills_to_add: [
      {
        skill_name: "alphanumeric_id_parser",
        description: "Extract numeric portion from alphanumeric identifiers like ORD-1001 → 1001",
        category: "SCHEMA_EVOLUTION",
      },
      {
        skill_name: "currency_string_parser",
        description: "Parse currency strings like '$49.99' into numeric DECIMAL values",
        category: "DATA_CLEANING",
      },
    ],
    enrichment_applied: ["pii_detection", "skill_matching", "graph_context"],
  },
];

/* ─── Audit ────────────────────────────────────────────────── */

export const MOCK_AUDIT: AuditEntry[] = [
  {
    id: 1,
    proposal_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    filename: "clean_orders.csv",
    skill_name: "auto_link_passthrough",
    execution_status: "SUCCESS",
    human_approver_id: "maya.chen",
    executed_at: hoursAgo(2),
    llm_prompt_sent: "You are a data engineering agent. Analyze the incoming CSV schema against the target table 'orders_clean' and generate a safe Python transformation script...",
    llm_raw_response: '{"gateway_recommendation": "AUTO_LINK", "confidence": 0.98, "reasoning": "All columns match", "drift_items": [], "code": "..."}',
    transformation_script_ref: "scripts/auto_link_a1b2c3d4.py",
  },
  {
    id: 2,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    filename: "drifted_orders.csv",
    skill_name: "schema_evolution_transform",
    execution_status: "SUCCESS",
    human_approver_id: "maya.chen",
    executed_at: hoursAgo(5),
    llm_prompt_sent: "You are a data engineering agent. Analyze the incoming CSV schema against the target table 'orders_clean'. Drift detected: RENAME order_amount→amount_usd, NULL_VIOLATION in order_status, EXTRA_COLUMN discount_code...",
    llm_raw_response: '{"gateway_recommendation": "SCHEMA_EVOLUTION", "confidence": 0.85, "reasoning": "3 drift items resolvable", "drift_items": [...], "code": "..."}',
    transformation_script_ref: "scripts/schema_evo_b2c3d4e5.py",
  },
  {
    id: 3,
    proposal_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    filename: "clean_orders_v2.csv",
    skill_name: "auto_link_passthrough",
    execution_status: "SUCCESS",
    human_approver_id: "alex.kumar",
    executed_at: daysAgo(1),
    llm_prompt_sent: "You are a data engineering agent. Analyze the incoming CSV schema against the target table 'orders_clean'...",
    llm_raw_response: '{"gateway_recommendation": "AUTO_LINK", "confidence": 0.99, "reasoning": "Perfect match", "code": "..."}',
    transformation_script_ref: "scripts/auto_link_c3d4e5f6.py",
  },
  {
    id: 4,
    proposal_id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    filename: "supplier_export_q2.csv",
    skill_name: "rename_column",
    execution_status: "SUCCESS",
    human_approver_id: "maya.chen",
    executed_at: daysAgo(2),
    llm_prompt_sent: "You are a data engineering agent. Analyze the incoming CSV...",
    llm_raw_response: '{"gateway_recommendation": "SCHEMA_EVOLUTION", "confidence": 0.91, "code": "..."}',
    transformation_script_ref: "scripts/schema_evo_d4e5f6a7.py",
  },
];

/* ─── Quarantine ───────────────────────────────────────────── */

export const MOCK_QUARANTINE: QuarantineEntry[] = [
  {
    id: 1,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    raw_row: {
      order_id: 1042,
      customer_id: null,
      order_amount: 0,
      order_status: null,
      customer_email: "invalid-email",
      created_at: "not-a-date",
      discount_code: "SAVE20",
    },
    failure_reason: "customer_id is null (required), created_at is not a valid timestamp, customer_email fails format validation",
    quarantined_at: hoursAgo(5),
  },
  {
    id: 2,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    raw_row: {
      order_id: 1043,
      customer_id: 512,
      order_amount: -25.0,
      order_status: "completed",
      customer_email: "test@example.com",
      created_at: "2024-03-15 14:30:00",
      discount_code: "SPRING",
    },
    failure_reason: "amount_usd is negative (-25.00) — likely data entry error",
    quarantined_at: hoursAgo(5),
  },
  {
    id: 3,
    proposal_id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    raw_row: {
      order_id: 2099,
      customer_id: 999,
      total_amount: "NaN",
      order_status: "processing",
      email: "user@domain.com",
      created_at: "2024-06-01 09:00:00",
    },
    failure_reason: "total_amount='NaN' cannot be converted to numeric type",
    quarantined_at: daysAgo(2),
  },
];

/* ─── Sources ──────────────────────────────────────────────── */

export const MOCK_SOURCES: WarehouseUnitResponse[] = [
  {
    id: 1,
    name: "Production_Warehouse_PG",
    unit_type: "POSTGRES",
    status: "CONNECTED",
  },
];

/* ─── Skills ───────────────────────────────────────────────── */

export const MOCK_SKILLS: SkillResponse[] = [
  {
    id: 1,
    skill_name: "pii_masking",
    version: "1.0.0",
    category: "SECURITY",
    description: "Hashes PII columns (email, phone, SSN) using SHA-256 to protect customer data.",
    use_cases: "Any dataset containing customer contact information or government IDs.",
    constraints: "Column must be non-null and string type. Hash is one-way — original value cannot be recovered.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(30),
  },
  {
    id: 2,
    skill_name: "rename_column",
    version: "1.0.0",
    category: "SCHEMA_EVOLUTION",
    description: "Renames one or more columns to match the target schema standard names.",
    use_cases: "Supplier feeds with non-standard column names, legacy system exports.",
    constraints: "Source and target column data types must be compatible.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(30),
  },
  {
    id: 3,
    skill_name: "fill_nulls",
    version: "1.0.0",
    category: "DATA_CLEANING",
    description: "Fills null values in specified columns with a default value or forward-fill strategy.",
    use_cases: "Order status fields, categorical columns with known default values.",
    constraints: "Default value must match column data type. Never fills primary key columns.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(28),
  },
  {
    id: 4,
    skill_name: "type_conversion",
    version: "1.0.0",
    category: "SCHEMA_EVOLUTION",
    description: "Converts column data types (e.g. string → integer, string → timestamp).",
    use_cases: "CSV uploads where all values arrive as strings.",
    constraints: "Conversion must be lossless. Raises on data that cannot be converted.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(28),
  },
  {
    id: 5,
    skill_name: "deduplicate_records",
    version: "1.0.0",
    category: "DATA_CLEANING",
    description: "Removes duplicate rows based on a primary key or composite key.",
    use_cases: "CRM imports, external API responses with repeated entries.",
    constraints: "Primary key column must be specified. Keeps the last seen record by default.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(25),
  },
  {
    id: 6,
    skill_name: "drop_extra_columns",
    version: "1.0.0",
    category: "SCHEMA_EVOLUTION",
    description: "Removes columns present in the incoming data that do not exist in the target schema.",
    use_cases: "Any ingestion where the source has more columns than the target.",
    constraints: "Only drops columns not in the target schema. Never drops required columns.",
    owner: "Data Engineering Team",
    status: "ACTIVE",
    created_at: daysAgo(25),
  },
];

export const MOCK_SKILL_DETAILS: Record<number, SkillDetailResponse> = {
  1: {
    ...MOCK_SKILLS[0],
    scripts: [
      {
        id: 1,
        skill_id: 1,
        script_path: "skills/pii_masking/hash_sha256.py",
        description: "SHA-256 hashing implementation for PII columns",
        created_at: daysAgo(30),
      },
    ],
    examples: [
      {
        input: { customer_email: "john@example.com" },
        output: { customer_email: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
      },
    ],
    issue_references: [
      {
        reference: "INC-101",
        notes: "Customer emails with Unicode characters failed SHA-256. Fixed by encoding to UTF-8 first.",
      },
    ],
  },
  2: {
    ...MOCK_SKILLS[1],
    scripts: [
      {
        id: 2,
        skill_id: 2,
        script_path: "skills/rename_column/rename.py",
        description: "Column renaming using pandas rename()",
        created_at: daysAgo(30),
      },
    ],
    examples: [
      {
        input: { order_amount: 49.99 },
        output: { amount_usd: 49.99 },
      },
    ],
    issue_references: [],
  },
  3: {
    ...MOCK_SKILLS[2],
    scripts: [],
    examples: [
      {
        input: { order_status: null },
        output: { order_status: "pending" },
      },
    ],
    issue_references: [],
  },
  4: {
    ...MOCK_SKILLS[3],
    scripts: [],
    examples: [
      {
        input: { amount: "49.99" },
        output: { amount: 49.99 },
      },
    ],
    issue_references: [],
  },
  5: {
    ...MOCK_SKILLS[4],
    scripts: [],
    examples: [],
    issue_references: [],
  },
  6: {
    ...MOCK_SKILLS[5],
    scripts: [],
    examples: [],
    issue_references: [],
  },
};

/* ─── Graph ────────────────────────────────────────────────── */

export const MOCK_GRAPH_NODES: GraphNodeResponse[] = [
  { id: 1, node_type: "WAREHOUSE", entity_id: "wh-1", entity_name: "Production_Warehouse_PG", metadata: { unit_type: "POSTGRES" } },
  { id: 2, node_type: "PROJECT", entity_id: "proj-1", entity_name: "E-Commerce Core", metadata: { data_owner: "Data Engineering Team", business_kpi_impact: "Directly feeds monthly revenue dashboard and customer LTV calculations" } },
  { id: 3, node_type: "TABLE", entity_id: "tbl-orders", entity_name: "orders_clean", metadata: { semantic_description: "Cleaned and validated order records from all sales channels." } },
  { id: 4, node_type: "TABLE", entity_id: "tbl-customers", entity_name: "customers", metadata: { semantic_description: "Master customer record table used by all order pipelines." } },
  { id: 5, node_type: "KPI", entity_id: "kpi-revenue", entity_name: "monthly_revenue", metadata: { description: "Aggregate revenue calculation used in executive dashboards." } },
  { id: 6, node_type: "SKILL", entity_id: "skill-pii", entity_name: "pii_masking", metadata: { category: "SECURITY" } },
  { id: 7, node_type: "SKILL", entity_id: "skill-rename", entity_name: "rename_column", metadata: { category: "SCHEMA_EVOLUTION" } },
  { id: 8, node_type: "COLUMN", entity_id: "col-customer-email", entity_name: "customer_email", metadata: { is_pii: true, parent_table: "orders_clean", data_type: "string" } },
  { id: 9, node_type: "COLUMN", entity_id: "col-order-id", entity_name: "order_id", metadata: { is_pii: false, parent_table: "orders_clean", data_type: "integer" } },
  { id: 10, node_type: "DASHBOARD", entity_id: "dash-exec", entity_name: "Executive Revenue Dashboard", metadata: { description: "Real-time executive dashboard showing revenue trends, customer acquisition, and order volume.", refresh_frequency: "hourly" } },
];

export const MOCK_GRAPH_EDGES: GraphEdgeResponse[] = [
  { id: 1, source_node_id: 2, target_node_id: 1, relation_type: "BELONGS_TO", confidence_score: 1.0, created_at: daysAgo(30) },
  { id: 2, source_node_id: 3, target_node_id: 2, relation_type: "BELONGS_TO", confidence_score: 1.0, created_at: daysAgo(30) },
  { id: 3, source_node_id: 3, target_node_id: 4, relation_type: "DEPENDS_ON", confidence_score: 0.95, created_at: daysAgo(30) },
  { id: 4, source_node_id: 3, target_node_id: 5, relation_type: "AFFECTS_KPI", confidence_score: 0.9, created_at: daysAgo(30) },
  { id: 5, source_node_id: 3, target_node_id: 6, relation_type: "USES_SKILL", confidence_score: 1.0, created_at: daysAgo(30) },
  { id: 6, source_node_id: 3, target_node_id: 7, relation_type: "USES_SKILL", confidence_score: 1.0, created_at: daysAgo(30) },
  { id: 7, source_node_id: 8, target_node_id: 3, relation_type: "BELONGS_TO", confidence_score: 1.0, created_at: daysAgo(28) },
  { id: 8, source_node_id: 9, target_node_id: 3, relation_type: "BELONGS_TO", confidence_score: 1.0, created_at: daysAgo(28) },
  { id: 9, source_node_id: 8, target_node_id: 6, relation_type: "PROTECTED_BY", confidence_score: 1.0, created_at: daysAgo(28) },
  { id: 10, source_node_id: 10, target_node_id: 5, relation_type: "DEPENDS_ON", confidence_score: 0.9, created_at: daysAgo(28) },
];

/* ─── Lineage ──────────────────────────────────────────────── */

export const MOCK_LINEAGE: LineageEventResponse[] = [
  {
    id: 1,
    proposal_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    source_entity: "clean_orders.csv",
    target_entity: "public.orders_clean",
    operation_type: "INGEST",
    skill_used: "auto_link_passthrough",
    executed_at: hoursAgo(2),
  },
  {
    id: 2,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    source_entity: "drifted_orders.csv",
    target_entity: "public.orders_clean",
    operation_type: "TRANSFORM",
    skill_used: "schema_evolution_transform",
    executed_at: hoursAgo(5),
  },
  {
    id: 3,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    source_entity: "drifted_orders.csv",
    target_entity: "conduit.quarantine_records",
    operation_type: "QUARANTINE",
    skill_used: "validation_check",
    executed_at: hoursAgo(5),
  },
  {
    id: 4,
    proposal_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    source_entity: "clean_orders_v2.csv",
    target_entity: "public.orders_clean",
    operation_type: "INGEST",
    skill_used: "auto_link_passthrough",
    executed_at: daysAgo(1),
  },
  {
    id: 5,
    proposal_id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    source_entity: "supplier_export_q2.csv",
    target_entity: "conduit.tables_metadata",
    operation_type: "EVOLVE",
    skill_used: "rename_column",
    executed_at: daysAgo(2),
  },
];

/* ─── Insights ─────────────────────────────────────────────── */

export const MOCK_INSIGHTS: InsightItem[] = [
  {
    id: 1,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    category: "CONCENTRATION",
    severity: "WARNING",
    title: "High concentration in order_status values",
    description: "78% of order_status values are 'completed'. This skew may indicate data collection bias or missing intermediate states (e.g. 'processing', 'shipped').",
    evidence: { value_distribution: { completed: 78, pending: 15, cancelled: 7 }, threshold: 70 },
    created_at: hoursAgo(5),
  },
  {
    id: 2,
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    category: "ANOMALY",
    severity: "CRITICAL",
    title: "Negative amount_usd values detected",
    description: "2 rows contain negative amount values (-25.00, -12.50). These were quarantined. Negative amounts may represent refunds that should flow through a separate pipeline.",
    evidence: { negative_rows: 2, values: [-25.0, -12.5] },
    created_at: hoursAgo(5),
  },
  {
    id: 3,
    proposal_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    category: "DATA_QUALITY",
    severity: "INFO",
    title: "All rows passed validation",
    description: "100% of 25 incoming rows passed all validation checks with no quarantined records. Data quality is excellent for this batch.",
    evidence: { total_rows: 25, passed: 25, quarantined: 0, pass_rate: 1.0 },
    created_at: hoursAgo(2),
  },
  {
    id: 4,
    proposal_id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    category: "PATTERN",
    severity: "INFO",
    title: "Recurring column rename pattern detected",
    description: "The rename 'total_amount → amount_usd' has appeared 3 times from this supplier. Consider creating a dedicated skill or configuring an alias in tables_metadata.",
    evidence: { pattern_count: 3, source_column: "total_amount", target_column: "amount_usd" },
    created_at: daysAgo(2),
  },
];

/* ─── Proposal Context ─────────────────────────────────────── */

export const MOCK_CONTEXTS: Record<string, ProposalContextResponse> = {
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
    proposal_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    target_table: "orders_clean",
    context_bundle: {
      related_skills: [
        { skill_name: "pii_masking", relevance: "HIGH", reason: "customer_email column detected as PII" },
      ],
      related_entities: [
        { entity: "orders_clean", type: "TABLE", relationship: "target" },
        { entity: "customers", type: "TABLE", relationship: "dependency" },
        { entity: "monthly_revenue", type: "KPI", relationship: "downstream" },
      ],
      pii_columns: ["customer_email"],
      business_context: "Core transactional data from the e-commerce platform. Directly feeds monthly revenue dashboard and customer LTV calculations.",
      dependencies: ["customers"],
    },
    generated_at: hoursAgo(2),
  },
  "b2c3d4e5-f6a7-8901-bcde-f12345678901": {
    proposal_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    target_table: "orders_clean",
    context_bundle: {
      related_skills: [
        { skill_name: "rename_column", relevance: "HIGH", reason: "order_amount → amount_usd rename detected" },
        { skill_name: "fill_nulls", relevance: "HIGH", reason: "null values in order_status" },
        { skill_name: "drop_extra_columns", relevance: "MEDIUM", reason: "extra column discount_code" },
        { skill_name: "pii_masking", relevance: "HIGH", reason: "customer_email column detected as PII" },
      ],
      related_entities: [
        { entity: "orders_clean", type: "TABLE", relationship: "target" },
        { entity: "customers", type: "TABLE", relationship: "dependency" },
        { entity: "monthly_revenue", type: "KPI", relationship: "downstream" },
        { entity: "Executive Revenue Dashboard", type: "DASHBOARD", relationship: "downstream" },
      ],
      pii_columns: ["customer_email"],
      business_context: "Core transactional data from the e-commerce platform. Directly feeds monthly revenue dashboard and customer LTV calculations.",
      dependencies: ["customers"],
    },
    generated_at: hoursAgo(5),
  },
};

/* ─── Suggest Target ───────────────────────────────────────── */

export const MOCK_SUGGEST_TARGET: SuggestTargetResponse = {
  data_understanding: "This CSV contains e-commerce order data with columns for order identification, customer references, monetary amounts, fulfillment status, and timestamps. The data structure closely matches a standard orders table schema.",
  incoming_columns: ["order_id", "customer_id", "amount_usd", "order_status", "customer_email", "created_at", "processed_at"],
  suggestions: [
    {
      table_name: "orders_clean",
      final_score: 0.95,
      column_match_score: 1.0,
      data_profile_score: 0.92,
      llm_confidence: 0.93,
      llm_reasoning: "All 7 incoming columns exist in the target schema with compatible data types. Value distributions are consistent with existing data patterns.",
      matched_columns: ["order_id", "customer_id", "amount_usd", "order_status", "customer_email", "created_at", "processed_at"],
      missing_columns: [],
      extra_columns: [],
    },
  ],
};

/* ─── Execution Results ────────────────────────────────────── */

export const MOCK_EXECUTION_RESULT: ExecutionResult = {
  proposal_id: "",
  rows_written: 18,
  rows_quarantined: 2,
  execution_status: "SUCCESS",
  duration_ms: 1247,
  insights: [
    {
      id: 100,
      proposal_id: "",
      category: "DATA_QUALITY",
      severity: "INFO",
      title: "Execution completed successfully",
      description: "18 of 20 rows were written to public.orders_clean. 2 rows were quarantined due to validation failures.",
      evidence: { rows_written: 18, rows_quarantined: 2, total: 20 },
      created_at: new Date().toISOString(),
    },
  ],
};

/* ─── Insights Summary ─────────────────────────────────────── */

export const MOCK_INSIGHTS_SUMMARY = {
  total: MOCK_INSIGHTS.length,
  by_category: {
    CONCENTRATION: 1,
    ANOMALY: 1,
    DATA_QUALITY: 1,
    PATTERN: 1,
  },
  by_severity: {
    INFO: 2,
    WARNING: 1,
    CRITICAL: 1,
  },
  recent_critical: MOCK_INSIGHTS.filter((i) => i.severity === "CRITICAL"),
};
