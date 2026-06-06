# Conduit Frontend — Requirements & API Specifications

**For**: Aditya (Frontend Engineer)  
**Project**: Conduit (Autonomous Agentic Data Engineering Framework)  
**Goal**: Design, build, and connect the Next.js frontend pages and components to the FastAPI backend. Ensure high visual excellence, rich micro-animations, glassmorphism UI elements, dark mode support, and seamless interactive elements.

---

## 1. Global Navigation & Layout

All pages must share a consistent global layout with a sidebar navigation that is clean, responsive, and responsive to active routing.

### 🧭 Sidebar Navigation Links
- **Dashboard (`/`)**: High-level metrics, active sources, recent executions, system status.
- **Ingest & Review (`/ingest`)**: File upload dropzone, interactive real-time proposal analysis.
- **Proposals (`/proposals`)**: Ledger of all schema resolutions and generated transformations.
- **Audit Logs (`/audit`)**: Immutable record of all executions, AI prompts, and generated transformation history.
- **Quarantine Logs (`/quarantine`)**: Detail view of rows failed during execution.
- **Data Sources (`/sources`)**: Connected warehouse units and their status.
- **Skill Registry (`/skills` — New)**: Registered skills, categorization, code attachments, and registration interface.
- **Knowledge Graph (`/graph` — New)**: Relationship graph visualization, downstream impact analyzer, and lineage explorer.

---

## 2. Page Specifications & Interactive Components

### 2.1 Overview Dashboard (`/`)
- **Key Metrics (Cards)**:
  - Total Files Processed
  - Auto-Resolved Rate (`AUTO_LINK` / total)
  - Quarantined Rows Count
  - Average Execution Duration (ms)
- **Active Data Warehouses**: Grid of connected sources showing database units, types, and connectivity status (Green/Red indicator).
- **Recent Executions Activity Feed**: Mini-table showing last 5 audit entries with direct links to audit details.
- **System Classification Breakdown**: Pie chart or bar indicator showing proportion of `AUTO_LINK`, `SCHEMA_EVOLUTION`, and `CONFLICT` classifications.

### 2.2 Ingest & Review (`/ingest`)
- **Drag-and-Drop Uploader**:
  - Select Target Table (dropdown fetched from `/api/sources`).
  - Dropzone accepting CSV/Parquet files.
  - Enforces client-side validation (blocks files >50MB, rejects non-CSV/Parquet).
- **Interactive Ingest State Machine**:
  1. *Idle State*: File selection & target table setup.
  2. *Uploading State*: File sending, progress bar.
  3. *AI Reasoning State*: Spinning loaders, animated terminal showing steps:
     - `Validating File Magic Bytes...`
     - `Introspecting Target Schema...`
     - `Building Context Bundle...`
     - `Generating Transformation Script via Llama-3.3-70B...`
     - `Validating AST Syntax & Imports Safety...`
     - `Classifying Gateway Policy Rules...`
  4. *Resolution Display State*: Renders the full `ProposalResponse` (Drift visualizer, generated code, AI reasoning).
  5. *Action Execution State*: Click **Approve** (executes script, updates database, transitions to success execution details) or **Reject** (returns to uploader).

### 2.3 Proposals List (`/proposals`)
- **Proposals Ledger Table**:
  - Columns: ID, Target Table, Classification (Badge: `AUTO_LINK` [Green], `SCHEMA_EVOLUTION` [Orange], `CONFLICT` [Red]), Confidence Score, Detected Drift Count, LLM Model, Created Time, Actions.
  - Filter by status (`AUTO_LINK`, `SCHEMA_EVOLUTION`, `CONFLICT`, etc.) and search by target table name.
  - Page pagination support.

### 2.4 Proposal Detail Review (`/proposals/[id]`)
- **Action Toolbar**: Header showing proposal ID and status badges. **Approve** button (opens credentials/approver ID input) and **Reject** button (opens reason modal).
- **Tabbed Review Interface**:
  - **Tab 1: Schema Drift Visualizer**:
    - Displays a side-by-side column mapping.
    - Highlights columns with drift:
      - `MISSING_COLUMN` (Missing in incoming - Red)
      - `EXTRA_COLUMN` (Extra in incoming - Orange)
      - `TYPE_MISMATCH` (Data type mismatch - Red)
      - `NULLABILITY_CHANGE` (Nullable column contains nulls when target is NOT NULL - Red)
    - Severity tag indicator (`LOW`, `MEDIUM`, `HIGH`).
  - **Tab 2: Transformation Code & AI Reasoning**:
    - Side-by-side or split layout.
    - *Left*: Markdown-rendered plain English AI reasoning (the *why* and *how* of the plan, plus warning notes).
    - *Right*: Beautiful syntax-highlighted editor showing the generated Python Pandas code (read-only).
  - **Tab 3: AI Context Bundle (Phase 2 feature)**:
    - Lists organizational context parsed before generating:
      - Detected PII Columns (e.g. `customer_email` - highlighted as secure).
      - Downstream Business KPI Impact (e.g. "Feeds Monthly Revenue dashboard").
      - Downstream Dependencies (other tables reading from this target table).
      - Applied Skills from Registry (links to the active skills matching the file schema).

### 2.5 Audit Ledger & Details (`/audit` and `/audit/[id]`)
- **Audit Ledger (`/audit`)**: Table showing executed pipelines. Shows ID, file name, active skill, status (SUCCESS/FAILED), approver ID, and execution time.
- **Audit Detail (`/audit/[id]`)**: Full traceback/post-mortem panel:
  - Summary of execution performance: duration, rows written, rows quarantined.
  - **Executed Script Tab**: Shows the exact Python script run inside the sandbox.
  - **AI Prompt Sent Tab**: Collapsible panel showing the exact XML-wrapped prompt fed to Llama.
  - **AI Raw JSON Response Tab**: Raw response JSON from Groq.

### 2.6 Quarantine Split-View (`/quarantine`)
- **List of Records**: Left panel shows list of quarantined records with timestamp, proposal ID, and error reason.
- **JSON Inspector**: Right panel shows the pretty-printed raw CSV/Parquet row JSON that failed validation or insertion. Allows searching key-value pairs to isolate data issues.

### 2.7 Data Sources (`/sources`)
- Grid layout showcasing database schemas, tables, expected column structures, row counts, and data distributions.

### 2.8 Skill Registry (`/skills` — New)
- **Skill Catalog Dashboard**:
  - Cards for registered skills showing category (`SECURITY`, `DATETIME_STANDARDIZATION`, `SCHEMA_EVOLUTION`, etc.), status (`ACTIVE`, `DRAFT`, `DEPRECATED`), and short description.
  - Search field to dynamically filter skills.
- **Skill Detail Panel (`/skills/[id]`)**:
  - Shows owner, version, use cases, and constraints.
  - Shows registered mapping scripts and issue context references.
  - Add script or add issue form to expand a skill's registry profile.
  - Mark as **Deprecated** (uses `PATCH /api/skills/{id}`) which adds visual deprecation badges.
- **Register Skill Dialog**:
  - Form fields: Name, category, description, use cases, constraints, owner, input/output examples.

### 2.9 Knowledge Graph & Lineage Explorer (`/graph` — New)
- **Interactive Node-Edge Visualizer**:
  - Rendered using D3.js, Vis.js, or Cytoscape.js.
  - Nodes: `TABLE` (Blue), `SKILL` (Purple), `COLUMN` (Teal), `KPI` (Gold), `PROJECT` (Gray), `FILE` (Green).
  - Edges: Connecting lines labelled with relation types (`BELONGS_TO`, `DEPENDS_ON`, `USES_SKILL`, `AFFECTS_KPI`, etc.).
  - Node hover shows tooltips with metadata (e.g., column PII flags, row count, schema definitions).
- **Lineage BFS Traversal**:
  - Enter a table or column name to display its linear source-to-target path graph.
- **Impact Analysis Panel**:
  - Select an entity (e.g. `orders_clean` table) and click "Analyze Downstream Impact".
  - Renders a tree of affected resources (dashboards, downstream tables, projects) with depth indicators. Helpful to visualize what breaks if a column changes.

---

## 3. API Endpoints Reference

All endpoints prefixed with `/api` are proxied by the Next.js dev server. Below is the API contract for integration.

### 3.1 Ingestion & Upload
#### `POST /api/ingest`
- **Request Type**: `multipart/form-data`
- **Payload**:
  - `file`: `UploadFile` (CSV or Parquet)
  - `target_table`: `string` (e.g., `"orders_clean"`)
- **Response Structure (`ProposalResponse`)**:
```json
{
  "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
  "gateway_status": "SCHEMA_EVOLUTION",
  "target_table": "orders_clean",
  "drift_detected": [
    {
      "column": "cust_email",
      "issue_type": "MISSING_COLUMN",
      "source_value": "cust_email",
      "target_expectation": "customer_email",
      "suggested_action": "RENAME",
      "severity": "MEDIUM"
    }
  ],
  "proposed_steps": [
    "Rename column 'cust_email' to 'customer_email'",
    "Format email values to lowercase",
    "Inject hash values for security mask if flagged"
  ],
  "generated_code": "import pandas as pd\n\ndef transform(df):\n    df = df.rename(columns={'cust_email': 'customer_email'})\n    return df",
  "confidence_score": 0.88,
  "pii_columns_found": ["customer_email"],
  "estimated_rows": 105,
  "llm_model_used": "llama-3.3-70b-versatile",
  "reasoning": "Detected column 'cust_email' that closely maps to 'customer_email' in the target schema. Renaming has been suggested. No other drifts found.",
  "reasoning_note": "A context rule exists showing customer_email is flagged as PII. Masking is recommended."
}
```

---

### 3.2 Proposals Management
#### `GET /api/proposals`
- **Query Params**:
  - `limit`: `int` (default: 100)
  - `offset`: `int` (default: 0)
- **Response**: List of `ProposalResponse` objects.

#### `GET /api/proposals/{proposal_id}`
- **Path Variable**: `proposal_id` (string uuid)
- **Response**: Singular `ProposalResponse` object.

#### `POST /api/proposals/{proposal_id}/approve`
- **Request Body (`ApproveRequest`)**:
```json
{
  "human_approver_id": "admin-aditya"
}
```
- **Response (`ExecutionResult`)**:
```json
{
  "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
  "rows_written": 100,
  "rows_quarantined": 5,
  "execution_status": "SUCCESS",
  "duration_ms": 142
}
```

#### `POST /api/proposals/{proposal_id}/reject`
- **Request Body (`RejectRequest`)**:
```json
{
  "reason": "Generated Python code contains invalid renaming syntax."
}
```
- **Response**: Status Code `200 OK`

#### `GET /api/proposals/{proposal_id}/context`
- **Response (`ProposalContextResponse`)**:
```json
{
  "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
  "target_table": "orders_clean",
  "context_bundle": {
    "related_skills": [
      {
        "id": 1,
        "name": "pii_masking",
        "category": "SECURITY",
        "description": "Hashes PII columns using SHA-256"
      }
    ],
    "related_entities": [
      {
        "id": 12,
        "name": "orders_clean",
        "node_type": "TABLE"
      }
    ],
    "dependencies": [
      {
        "name": "raw_orders",
        "node_type": "TABLE"
      }
    ],
    "business_context": [
      "Feeds Monthly Revenue calculation dashboard"
    ],
    "pii_columns": ["customer_email"]
  },
  "generated_at": "2026-06-07T03:30:00Z"
}
```

---

### 3.3 Skill Registry
#### `GET /api/skills`
- **Query Params**:
  - `category`: `string` (optional, e.g., `"SECURITY"`)
  - `status`: `string` (optional, e.g., `"ACTIVE"`)
  - `limit`: `int` (default: 100)
  - `offset`: `int` (default: 0)
- **Response**: List of `SkillResponse` objects.
```json
[
  {
    "id": 1,
    "skill_name": "pii_masking",
    "version": "1.0.0",
    "category": "SECURITY",
    "description": "Hashes PII columns using SHA-256",
    "use_cases": "Hashing emails, credit cards, SSNs",
    "constraints": "Requires valid string column",
    "owner": "Security Team",
    "status": "ACTIVE",
    "created_at": "2026-06-06T15:00:00Z"
  }
]
```

#### `GET /api/skills/search`
- **Query Params**:
  - `query`: `string` (term to search in name/description)
- **Response**: List of `SkillResponse` objects.

#### `GET /api/skills/{skill_id}`
- **Response (`SkillDetailResponse`)**:
```json
{
  "id": 1,
  "skill_name": "pii_masking",
  "version": "1.0.0",
  "category": "SECURITY",
  "description": "Hashes PII columns using SHA-256",
  "use_cases": "Hashing emails, credit cards, SSNs",
  "constraints": "Requires valid string column",
  "owner": "Security Team",
  "status": "ACTIVE",
  "created_at": "2026-06-06T15:00:00Z",
  "scripts": [
    {
      "id": 5,
      "script_path": "/scripts/masking.py",
      "script_hash": "a4f89d3...",
      "is_validated": true
    }
  ],
  "examples": [
    {
      "id": 2,
      "input": "john.doe@gmail.com",
      "output": "8fa8db6b6bfb4d40bfdf4a6c8e31ba6e..."
    }
  ],
  "issue_references": [
    {
      "id": 1,
      "issue_reference": "SEC-101",
      "resolution_notes": "Added hashing logic for GDPR compliance"
    }
  ]
}
```

#### `POST /api/skills`
- **Request Body (`CreateSkillRequest`)**:
```json
{
  "skill_name": "pii_masking",
  "version": "1.0.0",
  "category": "SECURITY",
  "description": "Hashes PII columns using SHA-256",
  "use_cases": "Encrypt sensitive fields",
  "constraints": "Python hashlib dependent",
  "owner": "Security Team",
  "examples": [
    {
      "input": "test",
      "output": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    }
  ]
}
```
- **Response**: Created `SkillResponse` object (`Status: 201 Created`).

#### `PATCH /api/skills/{skill_id}`
- **Request Body (`UpdateSkillRequest`)**:
```json
{
  "status": "DEPRECATED",
  "owner": "Core Platform team"
}
```
- **Response**: Updated `SkillResponse` object.

#### `POST /api/skills/{skill_id}/scripts`
- **Request Body (`AddSkillScriptRequest`)**:
```json
{
  "script_path": "/scripts/hashing_sha256.py",
  "script_hash": "847291a8df",
  "is_validated": true
}
```
- **Response**: Status Code `201 Created`

#### `POST /api/skills/{skill_id}/issues`
- **Request Body (`AddSkillIssueRequest`)**:
```json
{
  "issue_reference": "DATA-404",
  "resolution_notes": "Avoided plain text leakage in logs"
}
```
- **Response**: Status Code `201 Created`

---

### 3.4 Knowledge Graph
#### `GET /api/graph/nodes`
- **Response**: List of `GraphNodeResponse` objects.
```json
[
  {
    "id": 1,
    "node_type": "TABLE",
    "entity_id": "orders_clean",
    "entity_name": "Clean Orders",
    "metadata": {
      "row_count": 10500,
      "schema": "conduit"
    }
  },
  {
    "id": 2,
    "node_type": "SKILL",
    "entity_id": "pii_masking",
    "entity_name": "PII Masking",
    "metadata": {}
  }
]
```

#### `GET /api/graph/edges`
- **Response**: List of `GraphEdgeResponse` objects.
```json
[
  {
    "id": 1,
    "source_node_id": 1,
    "target_node_id": 2,
    "relation_type": "USES_SKILL",
    "confidence_score": 1.0,
    "created_at": "2026-06-06T18:00:00Z"
  }
]
```

#### `POST /api/graph/nodes`
- **Request Body (`CreateGraphNodeRequest`)**:
```json
{
  "node_type": "TABLE",
  "entity_id": "orders_clean",
  "entity_name": "Clean Orders",
  "metadata": {
    "schema": "conduit"
  }
}
```
- **Response**: Created `GraphNodeResponse` (`201 Created`).

#### `POST /api/graph/edges`
- **Request Body (`CreateGraphEdgeRequest`)**:
```json
{
  "source_node_id": 1,
  "target_node_id": 2,
  "relation_type": "USES_SKILL",
  "confidence_score": 0.95
}
```
- **Response**: Created `GraphEdgeResponse` (`201 Created`).

#### `GET /api/graph/neighbors/{node_id}`
- **Path Variable**: `node_id` (int)
- **Response (`NeighborsResponse`)**:
```json
{
  "node_id": 1,
  "neighbors": [
    {
      "direction": "outbound",
      "relation_type": "USES_SKILL",
      "confidence_score": 1.0,
      "node": {
        "id": 2,
        "node_type": "SKILL",
        "entity_id": "pii_masking",
        "entity_name": "PII Masking",
        "metadata": {}
      }
    }
  ],
  "total": 1
}
```

#### `GET /api/graph/lineage/{entity}`
- **Path Variable**: `entity` (string stable identifier, e.g. table/file name)
- **Response (`LineageGraphResponse`)**: Returns nodes and edges along BFS lineage path traversal.
```json
{
  "nodes": [
    { "id": 1, "node_type": "FILE", "entity_id": "clean_orders.csv", "entity_name": "clean_orders.csv" },
    { "id": 2, "node_type": "TABLE", "entity_id": "orders_clean", "entity_name": "Clean Orders Table" }
  ],
  "edges": [
    { "id": 1, "source_node_id": 1, "target_node_id": 2, "relation_type": "TRANSFORMS_INTO", "confidence_score": 1.0 }
  ]
}
```

#### `GET /api/graph/impact/{entity}`
- **Path Variable**: `entity` (string identifier)
- **Response (`ImpactAnalysisResponse`)**:
```json
{
  "entity": "orders_clean",
  "start_nodes": [
    { "id": 2, "node_type": "TABLE", "entity_id": "orders_clean", "entity_name": "Clean Orders Table" }
  ],
  "impacted_nodes": [
    {
      "node": {
        "id": 5,
        "node_type": "KPI",
        "entity_id": "monthly_revenue",
        "entity_name": "Monthly Revenue"
      },
      "depth": 1,
      "relation_type": "AFFECTS_KPI",
      "path": ["orders_clean", "monthly_revenue"]
    }
  ],
  "total_impacted": 1
}
```

---

### 3.5 Lineage Events Logger
#### `GET /api/lineage`
- **Query Params**:
  - `limit`: `int` (default: 100)
  - `offset`: `int` (default: 0)
- **Response**: List of `LineageEventResponse` objects.
```json
[
  {
    "id": 1,
    "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
    "source_entity": "clean_orders.csv",
    "target_entity": "orders_clean",
    "operation_type": "AUTO_LINK",
    "skill_used": "pii_masking",
    "executed_at": "2026-06-07T03:32:00Z"
  }
]
```

#### `GET /api/lineage/{proposal_id}`
- **Path Variable**: `proposal_id` (string uuid)
- **Response**: List of `LineageEventResponse` for specific proposal execution.

---

### 3.6 Data Sources
#### `GET /api/sources`
- **Response**: List of active Warehouse units.
```json
[
  {
    "id": 1,
    "name": "orders_clean",
    "unit_type": "TABLE",
    "status": "ACTIVE"
  }
]
```

---

### 3.7 Audit Trail
#### `GET /api/audit`
- **Query Params**:
  - `limit`: `int` (default: 100)
  - `offset`: `int` (default: 0)
- **Response**: List of `AuditEntry` objects.
```json
[
  {
    "id": 1,
    "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
    "filename": "clean_orders.csv",
    "skill_name": "pii_masking",
    "execution_status": "SUCCESS",
    "human_approver_id": "admin-aditya",
    "executed_at": "2026-06-07T03:32:00Z",
    "llm_prompt_sent": "<xml>...",
    "llm_raw_response": "{\"code\": ...}",
    "transformation_script_ref": "/scripts/8fa8db6b.py"
  }
]
```

#### `GET /api/audit/{entry_id}`
- **Path Variable**: `entry_id` (int)
- **Response**: Singular detailed `AuditEntry` object.

---

### 3.8 Quarantine Records
#### `GET /api/quarantine`
- **Query Params**:
  - `limit`: `int` (default: 100)
  - `offset`: `int` (default: 0)
- **Response**: List of `QuarantineEntry` objects.
```json
[
  {
    "id": 1,
    "proposal_id": "8fa8db6b-6bfb-4d40-bfdf-4a6c8e31ba6e",
    "raw_row": {
      "order_id": "999",
      "customer_email": "broken-email-no-at-sign",
      "amount": "abc"
    },
    "failure_reason": "ValueError: Invalid email format, ValueError: Could not parse amount as float",
    "quarantined_at": "2026-06-07T03:32:00Z"
  }
]
```

#### `GET /api/quarantine/{proposal_id}`
- **Path Variable**: `proposal_id` (string uuid)
- **Response**: List of `QuarantineEntry` records specifically generated by the given proposal's execution.
