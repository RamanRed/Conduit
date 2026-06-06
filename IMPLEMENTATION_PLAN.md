# Conduit Backend — Complete Implementation Plan
**Author**: Claude Analysis | **Date**: 2026-06-07  
**Based on**: Full audit of every file in the codebase  
**Goal**: Complete all missing backend logic, fix all bugs, implement Phase 2 AI context injection, and produce a fully-tested, working system.

---

## 0 — Current State Audit (What Is Actually Done vs What Is Not)

After reading every file in `backend/app/`, here is the true status:

### ✅ Working and Complete
| Component | File(s) | Status |
|-----------|---------|--------|
| Ingest pipeline (validation → schema → zero-overlap → MCP → AI → gateway → store) | `routers/ingest.py`, `services/ai_service.py`, `services/gateway_service.py`, `services/validation_service.py`, `services/mcp_service.py` | Working |
| Proposal CRUD (list, get, approve, reject, context) | `routers/proposals.py` | Working |
| Execution engine (exec sandbox, quarantine, ledger, lineage hook) | `services/execution_service.py` | Working |
| Audit trail | `routers/audit.py` | Working |
| Quarantine | `routers/quarantine.py` | Working |
| Sources | `routers/sources.py` | Working |
| Skill Registry models + all CRUD routes | `extension_models.py`, `services/skill_registry_service.py`, `routers/skills.py` | Working |
| Graph CRUD (nodes, edges, neighbors, BFS, impact) | `services/graph_service.py`, `routers/graph.py` | Working |
| Lineage recording + queries | `services/lineage_service.py`, `routers/lineage.py` | Working |
| Context bundle Phase 1 (built + stored, not injected) | `services/context_retrieval_service.py` | Partial — Phase 2 missing |
| Auto graph linking on execution | `services/execution_service.py` → `graph_service.auto_link_execution()` | Working |
| AI fallback cache | `routers/ingest.py` | Working |
| Mock AI (3 test scenarios) | `services/ai_service.py` | Working |

### ❌ Not Done / Broken / Incomplete
| Gap | Location | Severity |
|-----|----------|----------|
| **GAP-01** Graph tables have NO unique constraints → `ON CONFLICT DO NOTHING` in seed SQL silently does nothing; duplicate nodes/edges created on re-seed | `extension_models.py` | CRITICAL |
| **GAP-02** Context bundle built AFTER the AI call, not before → AI never sees it even in Phase 2 | `routers/ingest.py` | CRITICAL |
| **GAP-03** Phase 2 context injection into AI prompt NOT implemented | `services/ai_service.py` | CRITICAL (main feature) |
| **GAP-04** `Proposal` model has no `target_table` field → `execution_service.py` hardcodes `"orders_clean"` | `models.py`, `execution_service.py` | HIGH |
| **GAP-05** `seed_extensions.sql` uses `ON CONFLICT DO NOTHING` with no constraint → duplicate rows on every re-seed | `db/seed_extensions.sql` | HIGH |
| **GAP-06** SQL injection in `mcp_service.get_data_distribution()` via string interpolation | `services/mcp_service.py` | MEDIUM |
| **GAP-07** `get_or_create_node/edge` not race-condition safe (no IntegrityError catch) | `services/graph_service.py` | MEDIUM |
| **GAP-08** `Proposal.target_table` missing from `ProposalResponse` schema | `schemas.py`, `routers/proposals.py` | MEDIUM |
| **GAP-09** No validation of `relation_type` in graph edge creation | `routers/graph.py` | LOW |
| **GAP-10** `run_checks.py` is empty — no test coverage at all | `run_checks.py` | LOW |
| **GAP-11** Windows `/tmp/` path in `ingest.py` fails without Docker | `routers/ingest.py` | LOW (Docker handles) |
| **GAP-12** `SkillIssueReference` and `SkillScript` have no unique constraints → duplicate attach possible | `extension_models.py` | LOW |
| **GAP-13** Context bundle `related_skills` list in AI prompt not rich enough for Phase 2 | `services/context_retrieval_service.py` | LOW |
| **GAP-14** Quarantine endpoint has no pagination parameters | `routers/quarantine.py` | LOW |

---

## The 9 Implementation Stages

```
STAGE 1  →  DB Integrity (unique constraints on graph tables)
STAGE 2  →  Proposal model (add target_table, fix hardcoding)
STAGE 3  →  Phase 2 AI Context Injection (the main missing feature)
STAGE 4  →  Ingest reorder (context built BEFORE AI call, passed in)
STAGE 5  →  Graph service race-condition safety
STAGE 6  →  SQL injection fix + quarantine pagination
STAGE 7  →  Schema / response updates (target_table in ProposalResponse)
STAGE 8  →  Seed data fix + Dockerfile verification
STAGE 9  →  Comprehensive test suite (run_checks.py)
```

---

## STAGE 1 — Database Integrity: Unique Constraints on Graph Tables

### WHERE
`backend/app/extension_models.py` — `GraphNode` and `GraphEdge` classes

### WHAT
Add `UniqueConstraint` to both graph table models so that:
- `(node_type, entity_id)` is unique per node
- `(source_node_id, target_node_id, relation_type)` is unique per edge

### HOW

**Current code (broken):**
```python
class GraphNode(ExtBase):
    __tablename__ = "graph_nodes"
    __table_args__ = {"schema": "conduit_graph"}    # ← no unique constraint
```

**Fixed code:**
```python
class GraphNode(ExtBase):
    __tablename__ = "graph_nodes"
    __table_args__ = (
        UniqueConstraint("node_type", "entity_id", name="uq_graph_node_type_entity"),
        {"schema": "conduit_graph"},
    )
```

**Current code (broken):**
```python
class GraphEdge(ExtBase):
    __tablename__ = "graph_edges"
    __table_args__ = {"schema": "conduit_graph"}    # ← no unique constraint
```

**Fixed code:**
```python
class GraphEdge(ExtBase):
    __tablename__ = "graph_edges"
    __table_args__ = (
        UniqueConstraint(
            "source_node_id", "target_node_id", "relation_type",
            name="uq_graph_edge_src_tgt_rel"
        ),
        {"schema": "conduit_graph"},
    )
```

### WHY
1. `seed_extensions.sql` uses `ON CONFLICT DO NOTHING` — PostgreSQL only honours that syntax when there IS a unique constraint to conflict against. Without it, the seed SQL inserts duplicates on every run.
2. `get_or_create_node()` and `get_or_create_edge()` in `graph_service.py` use a SELECT-then-INSERT pattern. Under concurrent HTTP requests, two concurrent requests could both pass the SELECT check and both INSERT, creating duplicate graph nodes. The DB-level constraint is the last line of defence.
3. Lineage traversal BFS returns duplicate nodes/edges when duplicates exist, making the graph response confusing.

**Side effect**: SQLAlchemy `create_all()` at startup will CREATE these constraints. Since Docker creates a fresh DB, this runs on first start. If the DB already exists from a previous run (without constraints), the constraints won't be added automatically by `create_all()` — in that case, either restart Docker (wipe DB) or run a manual ALTER TABLE.

---

## STAGE 2 — Proposal Model: Add `target_table` Field

### WHERE
- `backend/app/models.py` — `Proposal` class (add field)
- `backend/app/routers/ingest.py` — save `target_table` when creating proposal
- `backend/app/services/execution_service.py` — use `proposal.target_table` instead of hardcoded string

### WHAT

**models.py**: Add `target_table = Column(String, nullable=True)` to `Proposal`.

**ingest.py**: When creating the Proposal object, set `target_table=target_table`.

**execution_service.py**: Replace every occurrence of `"orders_clean"` hardcode with `proposal.target_table or "orders_clean"`.

### HOW

In `models.py`, the `Proposal` class currently has:
```python
file_path = Column(String)
estimated_rows = Column(Integer, nullable=True)
```

Add after `file_path`:
```python
target_table = Column(String, nullable=True)
```

In `ingest.py`, every `Proposal(...)` constructor call gets:
```python
target_table=target_table,   # ← add this line
```

In `execution_service.py`, replace:
```python
table_name = "orders_clean"  # Hardcoded for demo, could parse from proposal
```
with:
```python
table_name = proposal.target_table or "orders_clean"
```

And all the `TableMetadata.table_name == "orders_clean"` selects become:
```python
TableMetadata.table_name == table_name
```

And the insert SQL:
```python
insert_sql = text(f"INSERT INTO {table_name} ...")   # already dynamic, just needs table_name fixed
```

### WHY
The current hardcoding silently fails for any table other than `orders_clean`. Since the system is designed as a general ETL platform (not just an orders pipeline), this is a fundamental correctness issue. The `target_table` is provided at ingest time by the user — it must be stored and used.

---

## STAGE 3 — Phase 2: AI Context Injection (Main Feature)

This is the biggest missing feature. The context bundle exists in the database but the AI never sees it. Phase 2 makes the AI aware of your organization's knowledge.

### WHERE
`backend/app/services/ai_service.py` — `generate_pipeline_proposal()` function

### WHAT
Add an optional `context_bundle: dict = None` parameter. When provided, inject a formatted context section into the user message sent to the LLM.

### HOW

**Current function signature:**
```python
async def generate_pipeline_proposal(
    incoming_schema: dict,
    target_schema: dict,
    sample_rows: list[dict],
    table_metadata: dict,
    retry_msg: str = None
) -> dict:
```

**New signature:**
```python
async def generate_pipeline_proposal(
    incoming_schema: dict,
    target_schema: dict,
    sample_rows: list[dict],
    table_metadata: dict,
    context_bundle: Optional[dict] = None,   # ← NEW
    retry_msg: str = None
) -> dict:
```

**Context section to inject into the user message:**
```python
context_section = ""
if context_bundle:
    related_skills = context_bundle.get("related_skills", [])
    related_entities = context_bundle.get("related_entities", [])
    dependencies = context_bundle.get("dependencies", [])
    business_context = context_bundle.get("business_context", [])
    pii_columns_from_graph = context_bundle.get("pii_columns", [])

    skills_block = ""
    for sk in related_skills:
        skills_block += f"\n  - {sk['name']} ({sk['category']}): {sk['description']}"

    context_section = f"""
ORGANIZATIONAL KNOWLEDGE CONTEXT:
Known PII columns in this table (from graph): {', '.join(pii_columns_from_graph) if pii_columns_from_graph else 'none detected'}
Related entities: {', '.join(e['name'] for e in related_entities) if related_entities else 'none'}
Dependencies (tables this table reads from): {', '.join(d['name'] for d in dependencies) if dependencies else 'none'}
Business KPI impact: {'; '.join(business_context) if business_context else 'not specified'}
Registered skills that may apply:{skills_block if skills_block else ' none'}

When generating the transformation:
- Prefer strategies consistent with the registered skills above
- Always mask the PII columns listed above, even if they appear safe
- Be aware this table feeds the business KPIs listed above — schema changes have downstream impact
"""
```

The `user_message` then includes `context_section` before the final instruction line.

**Why this matters for the AI**: Instead of a blank-slate response, the AI now reads:
```
Registered skills that may apply:
  - pii_masking (SECURITY): Hashes PII columns (email, phone, SSN) using SHA-256 to protect customer data.
  - rename_column (SCHEMA_EVOLUTION): Renames one or more columns to match the target schema standard names.

Known PII columns in this table (from graph): customer_email
Business KPI impact: Directly feeds monthly revenue dashboard and customer LTV calculations
```

The AI's generated code and reasoning will reflect this context — it will mention the PII requirement proactively, use the `pii_masking` skill approach, and flag KPI impact in its reasoning.

**Mock AI update**: The mock responses already include the correct behaviour, but we should add a `context_aware` flag to the mock response when a bundle is passed, so testers can see the context was used.

### WHY
This is the core value proposition of Phase 2:
- **Without context**: AI invents a solution from schema alone. Two similar files might get slightly different generated code.
- **With context**: AI applies the same PII masking approach every time because it sees `pii_masking` skill. It knows `customer_email` needs hashing because the graph has that COLUMN node flagged as PII. It knows to be careful because `orders_clean` feeds `monthly_revenue`.

This transforms Conduit from "AI code generator" into "AI that reasons over your organizational knowledge".

---

## STAGE 4 — Ingest Reorder: Build Context Bundle BEFORE AI Call

### WHERE
`backend/app/routers/ingest.py`

### WHAT
Currently the context bundle is built **after** the AI call and proposal is saved. For Phase 2, it must be built **before** the AI call so it can be passed in.

### HOW

**Current order in ingest.py (broken for Phase 2):**
```python
# Step 7: AI call
ai_resp = await ai_service.generate_pipeline_proposal(...)

# Step 10: Save proposal
db.add(proposal)
await db.commit()

# Step 11: Build + store context bundle (WRONG: after AI, too late for this call)
try:
    context_bundle = await context_retrieval_service.build_context_bundle(...)
    await context_retrieval_service.store_proposal_context(...)
except Exception:
    pass

# Step 12: Return response
return ProposalResponse(...)
```

**Correct order for Phase 2:**
```python
# Step 6.5: Build context bundle BEFORE AI call
context_bundle = None
try:
    context_bundle = await context_retrieval_service.build_context_bundle(
        db=db,
        target_table=target_table,
        incoming_columns=list(incoming_schema.keys()),
    )
except Exception:
    pass  # never block ingest

# Step 7: AI call WITH context bundle
ai_resp = await ai_service.generate_pipeline_proposal(
    incoming_schema,
    target_schema,
    sample_rows,
    table_metadata,
    context_bundle=context_bundle,   # ← PASSES CONTEXT TO AI
)

# Step 10: Save proposal
db.add(proposal)
await db.commit()

# Step 10.5: Store context bundle for the proposal (for GET /context endpoint)
try:
    if context_bundle:
        await context_retrieval_service.store_proposal_context(
            db=db,
            proposal_id=file_id,
            target_table=target_table,
            bundle=context_bundle,
        )
except Exception:
    pass  # never block ingest

# Step 11: Return response
return ProposalResponse(...)
```

Also: the zero-overlap fast path (where AI is skipped entirely) should NOT build a context bundle — no point fetching context for a definitively rejected file.

### WHY
A context bundle built after the AI call is useless for influencing that call. It's only useful if stored and retrieved by a future call (which is what Phase 1 did). Phase 2 means: use the knowledge NOW, not next time.

---

## STAGE 5 — Graph Service: IntegrityError Safety

### WHERE
`backend/app/services/graph_service.py` — `get_or_create_node()` and `get_or_create_edge()`

### WHAT
Wrap the INSERT portion in an `IntegrityError` catch. If a race condition causes a duplicate insert, catch the DB error, rollback the savepoint, and re-query to return the existing record.

### HOW

```python
from sqlalchemy.exc import IntegrityError

async def get_or_create_node(
    db: AsyncSession,
    node_type: str,
    entity_id: str,
    entity_name: str,
    metadata: Optional[dict] = None,
) -> GraphNode:
    result = await db.execute(
        select(GraphNode).where(
            GraphNode.node_type == node_type,
            GraphNode.entity_id == entity_id,
        )
    )
    existing = result.scalars().first()
    if existing:
        return existing
    try:
        return await create_node(db, node_type, entity_id, entity_name, metadata)
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(GraphNode).where(
                GraphNode.node_type == node_type,
                GraphNode.entity_id == entity_id,
            )
        )
        return result.scalars().first()
```

Same pattern for `get_or_create_edge()`.

### WHY
FastAPI is async. Two concurrent HTTP requests could call `get_or_create_node()` simultaneously: both pass the SELECT check (node doesn't exist yet), both attempt INSERT. Without the constraint + IntegrityError catch, one insert silently creates a duplicate. With the constraint (Stage 1) + this catch, the second insert raises IntegrityError, we rollback, and return the node the first request just created.

---

## STAGE 6 — SQL Injection Fix + Quarantine Pagination

### WHERE
- `backend/app/services/mcp_service.py` — `get_data_distribution()`
- `backend/app/routers/quarantine.py` — both endpoints

### WHAT

**mcp_service.py**: The current code uses `text(f"SELECT COUNT(*) FROM {table_name}")` where `table_name` comes from user input. Although there IS a regex check already, the safest approach is to validate against the registered metadata tables list.

**Current code (partially safe but fragile):**
```python
if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$", table_name):
    raise ValueError("Invalid table name")
```

**Better fix**: Validate against DB allowlist, not just regex:
```python
# Validate table_name is a registered table before using it in SQL
stmt_check = select(TableMetadata).where(TableMetadata.table_name == simple_table_name)
result_check = await db.execute(stmt_check)
if result_check.scalars().first() is None:
    # Not registered — reject
    return {}
```

**quarantine.py**: Add `limit` and `offset` parameters to both endpoints (matching the proposals/audit pattern):
```python
@router.get("/quarantine", response_model=List[QuarantineEntry])
async def get_quarantine(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(QuarantineRecord).order_by(QuarantineRecord.quarantined_at.desc()).limit(limit).offset(offset)
```

### WHY
- SQL injection: the table name flows from user-provided `target_table` form field through MCP service queries. The regex guards against most attacks but is not the standard approach. Metadata validation is more correct because it also checks the table is known to the system.
- Quarantine pagination: the test scenarios expect `GET /api/quarantine` to be listable. For large deployments, unbounded queries are dangerous.

---

## STAGE 7 — Schema Updates: `target_table` in ProposalResponse

### WHERE
- `backend/app/schemas.py` — `ProposalResponse`
- `backend/app/routers/proposals.py` — all places that construct `ProposalResponse`

### WHAT

Add `target_table: Optional[str] = None` to `ProposalResponse`:

```python
class ProposalResponse(BaseModel):
    proposal_id: str
    gateway_status: str
    target_table: Optional[str] = None    # ← NEW
    drift_detected: List[DriftItem]
    ...
```

In `proposals.py`, populate it:
```python
return ProposalResponse(
    proposal_id=p.id,
    gateway_status=p.gateway_status,
    target_table=p.target_table,          # ← NEW
    drift_detected=drift_items,
    ...
)
```

In `ingest.py`, populate it in the final return:
```python
return ProposalResponse(
    proposal_id=file_id,
    gateway_status=gateway_status,
    target_table=target_table,            # ← NEW
    ...
)
```

### WHY
The frontend needs to know what table a proposal targets. The test scenarios document references `target_table` in context bundle responses. Consistency requires it in the proposal response too.

---

## STAGE 8 — Seed Data Fix

### WHERE
`db/seed_extensions.sql`

### WHAT
Fix the `ON CONFLICT DO NOTHING` clauses to use the correct constraint names (which Stage 1 created):

**Current (broken):**
```sql
INSERT INTO conduit_graph.graph_nodes (...)
VALUES (...)
ON CONFLICT DO NOTHING;
```

**Fixed:**
```sql
INSERT INTO conduit_graph.graph_nodes (...)
VALUES (...)
ON CONFLICT ON CONSTRAINT uq_graph_node_type_entity DO NOTHING;
```

**For edges:**
```sql
INSERT INTO conduit_graph.graph_edges (...)
SELECT s.id, t.id, 'BELONGS_TO', 1.0
FROM conduit_graph.graph_nodes s, conduit_graph.graph_nodes t
WHERE s.entity_id = 'proj-1' AND t.entity_id = 'wh-1'
ON CONFLICT ON CONSTRAINT uq_graph_edge_src_tgt_rel DO NOTHING;
```

Also: add a `pipeline_skills_ledger` table to the seed SQL — currently this table is only created by SQLAlchemy ORM via `create_all()`, not by the seed SQL. Since the Docker init runs the seed SQL before the API starts, if the table doesn't exist when seed runs (which it doesn't, because ORM creates it on startup), the seed is fine. BUT the extension seed (seed_extensions.sql) runs AFTER the API starts, so the graph tables DO exist. No change needed here — just confirming the order is correct.

### ALSO: Add enhanced seed data for Phase 2 demo

Add more graph nodes to make the context bundle richer:
- COLUMN nodes for `customer_email` and `order_id` with `is_pii` flags
- More SKILL-to-TABLE USES_SKILL edges
- A DASHBOARD node linked to the KPI node

This makes the Phase 2 context injection visibly more powerful during a demo.

### WHY
Without correct `ON CONFLICT` syntax, every time `seed_extensions.sql` is run (which the README says to do after `docker-compose up`), it creates duplicate rows. This corrupts the graph and skill registry.

---

## STAGE 9 — Comprehensive Test Suite

### WHERE
`run_checks.py` (currently empty)

### WHAT
A self-contained Python test script that:
1. Has no external dependencies beyond `httpx` and `json`
2. Runs all 12 test scenarios from the test document
3. Prints pass/fail for each assertion
4. Works against `http://localhost:8000/api`
5. Is idempotent — can be run multiple times
6. Saves uploaded test files to `/tmp` for cleanup

### Test Coverage Map

| Test Scenario | Description | Key Assertions |
|---------------|-------------|----------------|
| A | Clean upload → AUTO_LINK | gateway_status=AUTO_LINK, rows_written=5, lineage event created, graph auto-populated |
| B | Drifted upload → SCHEMA_EVOLUTION | 3 drift items, correct types, approval succeeds |
| C | Conflict upload → CONFLICT | HIGH severity items, quarantine populated after force-approve |
| D | Zero column overlap → fast CONFLICT | llm_model_used=none, confidence_score=0.0 |
| E | File safety | PDF rejected, empty file rejected, 50MB+ rejected |
| F | Skill lifecycle | Create, get, search, attach script, attach issue, deprecate, verify search excludes deprecated |
| G | Graph manual ops | Create nodes, create edges, BFS lineage, impact analysis, idempotent edge |
| H | Lineage queries | List all events, filter by proposal |
| I | AI fallback | Invalid Groq key → cached-fallback response (skip if MOCK_AI=True) |
| J | Audit completeness | All fields present per spec table |
| K | Proposals filtering | status filter, pagination |
| L | Context bundle growth | Register skill, add graph node, re-ingest, verify context bundle enriched |

### Script Structure

```python
#!/usr/bin/env python3
"""
Conduit Backend Test Suite
Covers all 12 scenarios from the test document.
Run: python run_checks.py
"""
import httpx, json, sys, os, time
from pathlib import Path

BASE = "http://localhost:8000/api"
PASS = "✅"
FAIL = "❌"
SKIP = "⚠️ "

results = {"pass": 0, "fail": 0, "skip": 0}

def check(name: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  {PASS} {name}")
        results["pass"] += 1
    else:
        print(f"  {FAIL} {name} — {detail}")
        results["fail"] += 1

def run_scenario(label: str):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print('='*60)

# ... test functions per scenario ...
```

### How the script handles file uploads
Use `httpx` multipart/form-data:
```python
with open("db/demo_csvs/clean_orders.csv", "rb") as f:
    resp = httpx.post(
        f"{BASE}/ingest",
        files={"file": ("clean_orders.csv", f, "text/csv")},
        data={"target_table": "orders_clean"},
        timeout=30
    )
```

---

## Execution Order for Implementation

### Day 1 (Critical fixes — system correctness)
```
1. STAGE 1  — Add unique constraints to graph tables (extension_models.py)
2. STAGE 2  — Add target_table to Proposal model + fix execution_service.py hardcoding
3. STAGE 8  — Fix seed_extensions.sql (ON CONFLICT constraint names)
```

### Day 1 (Phase 2 — main feature)
```
4. STAGE 3  — AI context injection in ai_service.py
5. STAGE 4  — Ingest reorder (build context before AI call in ingest.py)
```

### Day 2 (Robustness)
```
6. STAGE 5  — Graph service IntegrityError safety
7. STAGE 6  — SQL injection fix + quarantine pagination
8. STAGE 7  — target_table in ProposalResponse schema
```

### Day 2 (Verification)
```
9. STAGE 9  — Write and run comprehensive test suite
10. Fix any bugs found by tests
```

---

## Architecture Diagram: What Phase 2 Looks Like After All Stages

```
CSV Upload
    │
    ▼
Validation (magic bytes, size)
    │
    ▼
Schema Detection (pandas)
    │
    ▼
Zero-overlap Check (fast path → CONFLICT if no columns match)
    │
    ▼
MCP Metadata Fetch (target table column definitions)
    │
    ▼
◄─── STAGE 4 ADDS THIS ────────────────────────────┐
Context Bundle Build (graph BFS + skill keyword search)│
    │  [related_skills, related_entities, pii_cols,  │
    │   dependencies, business_context]              │
    └──────────────────────────────────────────────►─┘
    │
    ▼
◄─── STAGE 3 ADDS THIS ────────────────────────────┐
AI Call WITH context bundle                         │
    │  System: "You are data engineering AI"        │
    │  User:   "TARGET SCHEMA: ... INCOMING: ...    │
    │           ORGANIZATIONAL CONTEXT:             │
    │             PII columns: customer_email        │
    │             Skills available: pii_masking      │
    │             KPI impact: monthly_revenue"       │
    └──────────────────────────────────────────────►─┘
    │
    ▼
Code Validation (AST parse, unsafe term check)
    │
    ▼
Gateway Classification (deterministic rule override)
    │
    ▼
Proposal Storage (PENDING)
    │
    ▼
Context Bundle Storage (for GET /proposals/{id}/context)
    │
    ▼
Response → Human Review → Approve/Reject
    │                          │
    │                          ▼ (on approve)
    │                    Execute Transform
    │                          │
    │                          ▼
    │                    Lineage Event Record
    │                          │
    │                          ▼
    │                    Graph Auto-Link
    │                    (FILE→TABLE→SKILL nodes+edges)
    │
    ▼
Knowledge Graph grows richer with each execution
Next ingest gets even better context → better AI output
```

---

## Key Files Changed Summary

| File | Stage | Change Type |
|------|-------|-------------|
| `extension_models.py` | 1 | Add UniqueConstraint to GraphNode + GraphEdge |
| `models.py` | 2 | Add target_table field to Proposal |
| `services/execution_service.py` | 2 | Use proposal.target_table, not hardcoded string |
| `services/ai_service.py` | 3 | Add context_bundle param + inject into prompt |
| `routers/ingest.py` | 4 | Reorder: context before AI; pass bundle to AI; add target_table |
| `services/graph_service.py` | 5 | IntegrityError catch in get_or_create_node/edge |
| `services/mcp_service.py` | 6 | Validate table name against registered list |
| `routers/quarantine.py` | 6 | Add limit/offset pagination |
| `schemas.py` | 7 | Add target_table to ProposalResponse |
| `routers/proposals.py` | 7 | Populate target_table in all ProposalResponse constructors |
| `db/seed_extensions.sql` | 8 | Fix ON CONFLICT constraint names; add COLUMN PII nodes |
| `run_checks.py` | 9 | Complete rewrite: 12 scenario test suite |

---

## Files NOT Changed (by design)

Per the spec: "DO NOT modify existing API behavior."

| File | Reason unchanged |
|------|-----------------|
| `routers/audit.py` | Complete and correct |
| `routers/sources.py` | Complete and correct |
| `services/gateway_service.py` | Complete, deterministic rules work |
| `services/validation_service.py` | Complete, magic byte + AST checks work |
| `services/lineage_service.py` | Complete |
| `services/context_retrieval_service.py` | Complete (Phase 1 logic) |
| `services/skill_registry_service.py` | Complete |
| `app/database.py` | Complete |
| `app/core/config.py` | Complete |
| `app/extension_schemas.py` | Complete |
| `docker-compose.yml` | Complete |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Adding unique constraints fails on existing DB | Medium | Medium | Always wipe DB (docker-compose down -v) before applying; Stage 1 is idempotent on fresh DB |
| Phase 2 context injection changes AI output | High | Low | Completely expected — this is the feature. Mock AI still returns same structure. |
| Reordering ingest.py breaks existing tests | Low | Medium | Context bundle failure is caught in try/except, so even if graph is empty, ingest continues |
| target_table migration on existing proposals | Medium | Low | Field is nullable — old proposals will have null target_table, execution falls back to "orders_clean" |
| run_checks.py assertions too strict | Low | Low | Script designed to show SKIP for unavailable features, not FAIL |

---

## Definition of Done

The implementation is complete when:

1. `python run_checks.py` passes all Scenario A through L tests (or shows intentional SKIPs for MOCK_AI=True scenarios)
2. `GET /api/proposals/{id}/context` returns `related_skills` and `related_entities` populated  
3. The generated AI code for `drifted_orders.csv` references `pii_masking` concept in its reasoning when the skill is registered
4. `GET /api/graph/nodes` returns no duplicates after running seed + two ingests  
5. `GET /api/graph/impact/orders_clean` returns `invoices` and `quarterly_revenue` after Scenario G setup  
6. All 12 endpoints in the quick reference list return 200/201 (not 422 or 500)
7. Skill lifecycle (F.1→F.9) works end to end including deprecation
