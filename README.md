# Conduit

Conduit is an autonomous agentic data engineering framework that detects schema drift between incoming data files and target database tables, generates safe transformation plans, validates them, and presents them to a human engineer for approval before execution.

## Project Structure

```
Conduit/
├── backend/                  # FastAPI backend (Python)
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── models.py         # ORM models (conduit schema)
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── routers/          # API endpoints
│   │   │   ├── ingest.py
│   │   │   ├── proposals.py
│   │   │   ├── audit.py
│   │   │   ├── quarantine.py
│   │   │   └── sources.py
│   │   ├── services/         # Business logic
│   │   │   ├── mcp_service.py        # Schema introspection
│   │   │   ├── ai_service.py         # Groq AI integration
│   │   │   ├── gateway_service.py    # Classification rules
│   │   │   ├── execution_service.py  # Safe exec + insert
│   │   │   └── validation_service.py # File + code validation
│   │   └── core/
│   │       └── config.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── db/
│   ├── seed_warehouse.sql    # Auto-loaded on Postgres init
│   └── demo_csvs/            # Test files
│       ├── clean_orders.csv
│       ├── drifted_orders.csv
│       └── conflicted_orders.csv
├── docker-compose.yml        # Spins up Postgres + API
├── run_checks.py             # End-to-end verification script
└── README.md
```

## Quick Start

1. Copy environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```
   - Add your `GROQ_API_KEY` from [console.groq.com](https://console.groq.com)
   - Set `MOCK_AI=False` to use real AI, or `True` for local mock testing

2. Start all services (run from the `Conduit/` directory):
   ```bash
   cd Conduit
   docker compose up -d
   ```

3. Access the API:
   - API: `http://localhost:8000`
   - Interactive docs: `http://localhost:8000/docs`

4. Run the verification suite (optional):
   ```bash
   python run_checks.py
   ```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest` | POST | Upload file + generate AI proposal |
| `/api/proposals/{id}` | GET | Retrieve proposal details |
| `/api/proposals/{id}/approve` | POST | Execute approved transformation |
| `/api/proposals/{id}/reject` | POST | Reject a proposal |
| `/api/audit` | GET | List execution history |
| `/api/audit/{id}` | GET | Full audit details for one execution |
| `/api/quarantine` | GET | List quarantined rows |
| `/api/sources` | GET | List registered data sources |

## Classification States

Every proposal is classified into one of three states:

- **AUTO_LINK** — No drift, high confidence (>0.92)
- **SCHEMA_EVOLUTION** — Detectable drift with clear fix
- **CONFLICT** — Type mismatches, missing required columns, or low confidence

The backend enforces rule-based overrides on top of AI recommendations.

## Environment Variables

```env
GROQ_API_KEY=gsk_...
WAREHOUSE_DB_URL=postgresql+asyncpg://user:password@warehouse-db:5432/warehousedb
SOURCE_DB_URL=postgresql+asyncpg://user:password@source-db:5432/sourcedb
MOCK_AI=False
ENVIRONMENT=development
```

## Database Schema

The `conduit` schema contains:

- `warehouse_units` — Physical data sources
- `sub_projects` — Logical groupings
- `tables_metadata` — Registered target tables
- `attributes_metadata` — Column-level metadata
- `pipeline_skills_ledger` — Audit log
- `quarantine_records` — Failed rows
- `proposals` — AI-generated transformation plans
