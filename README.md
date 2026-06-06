# Conduit

Conduit is an autonomous agentic data engineering framework that detects schema drift between incoming data files and target database tables, generates safe transformation plans, validates them, and presents them to a human engineer for approval before execution.

## Project Structure

```
Conduit/
├── backend/                  # FastAPI backend (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/          # /ingest, /proposals, /audit, /quarantine, /sources
│   │   ├── services/         # mcp, ai, gateway, execution, validation
│   │   └── core/config.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Next.js frontend (TypeScript)
│   ├── src/
│   │   ├── app/              # App router pages
│   │   ├── components/       # Shared UI components
│   │   └── lib/              # API client, types, formatters
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── db/
│   ├── seed_warehouse.sql    # Auto-loaded on Postgres init
│   └── demo_csvs/            # Test files
├── docker-compose.yml        # Spins up Postgres + API
└── README.md
```

## Quick Start

### 1. Backend (FastAPI)

```bash
cd Conduit
cp backend/.env.example backend/.env
# Edit .env to add GROQ_API_KEY
docker compose up -d
```

The API will be available at `http://localhost:8000`.

### 2. Frontend (Next.js)

```bash
cd Conduit/frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:3000`.

The frontend proxies `/api/*` requests to the backend, so no extra config is needed.

## Demo Data

Test the system with these files (in `db/demo_csvs/`):

- `clean_orders.csv` — clean schema, expected to land in `AUTO_LINK`
- `drifted_orders.csv` — has renames, extra columns, and nulls → `SCHEMA_EVOLUTION`
- `conflicted_orders.csv` — type mismatches and missing required columns → `CONFLICT`

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/ingest` | Upload file + generate AI proposal |
| `GET` | `/api/proposals/{id}` | Retrieve proposal details |
| `POST` | `/api/proposals/{id}/approve` | Execute approved transformation |
| `POST` | `/api/proposals/{id}/reject` | Reject a proposal |
| `GET` | `/api/audit` | List execution history |
| `GET` | `/api/audit/{id}` | Full audit details for one execution |
| `GET` | `/api/quarantine` | List quarantined rows |
| `GET` | `/api/sources` | List registered data sources |

## Classification States

Every proposal is classified into one of three states:

- **AUTO_LINK** — No drift, high confidence (>0.92)
- **SCHEMA_EVOLUTION** — Detectable drift with clear fix
- **CONFLICT** — Type mismatches, missing required columns, or low confidence

The backend enforces rule-based overrides on top of AI recommendations.

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Overview dashboard with stats, recent executions, and source status |
| `/ingest` | File upload + inline proposal review with confidence scoring |
| `/proposals` | All proposals in a table view |
| `/proposals/[id]` | Detailed proposal review with drift/code/prompt tabs and approve/reject actions |
| `/audit` | Audit ledger with status filters |
| `/audit/[id]` | Full audit detail with executed script, AI prompt, and raw response |
| `/quarantine` | Split-view of quarantined rows with raw data and failure reason |
| `/sources` | Registered data warehouse units and connectivity status |
