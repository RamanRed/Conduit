@echo off
cd /d "C:\Users\raman\Desktop\trainer module\Etl Pipeline\Conduit"

echo [Conduit] Staging extension files...
git add backend/app/extension_models.py
git add backend/app/extension_schemas.py
git add backend/app/main.py
git add backend/app/services/skill_registry_service.py
git add backend/app/services/graph_service.py
git add backend/app/services/lineage_service.py
git add backend/app/services/context_retrieval_service.py
git add backend/app/services/execution_service.py
git add backend/app/routers/skills.py
git add backend/app/routers/graph.py
git add backend/app/routers/lineage.py
git add db/seed_extensions.sql

echo [Conduit] Committing...
git commit -m "feat(extension): add Skill Registry, Relationship Graph, Lineage Engine

Backend-only, fully additive. Zero existing API/model changes.

New schemas:
  - conduit_skills: skills, skill_scripts, skill_examples, skill_issue_references
  - conduit_graph:  graph_nodes, graph_edges
  - conduit_lineage: lineage_events

New services:
  - skill_registry_service.py (register, get, list, find_matching_skills)
  - graph_service.py (create_node, create_edge, get_neighbors, get_lineage, get_dependencies)
  - lineage_service.py (record_event, list_events, get_events_for_proposal)
  - context_retrieval_service.py (build_context_bundle - Phase 1: stored, not yet injected)

New API routers:
  - GET/POST /api/skills, GET /api/skills/{id}
  - GET /api/graph/nodes, GET /api/graph/edges, GET /api/graph/lineage/{entity}
  - GET /api/lineage, GET /api/lineage/{proposal_id}

Additive hook in execution_service.py:
  - lineage_service.record_event() called after successful execution
  - No execution logic changed

main.py startup:
  - Auto-creates conduit_skills, conduit_graph, conduit_lineage schemas
  - Registers 3 new routers

Seed data:
  - db/seed_extensions.sql: 6 demo skills + examples + issue refs + 7 graph nodes + 6 edges

Non-breaking: all existing /api/ingest, /api/proposals/*, /api/audit/*,
/api/quarantine/*, /api/sources routes and models are untouched."

echo [Conduit] Done. Check git log for confirmation.
pause
