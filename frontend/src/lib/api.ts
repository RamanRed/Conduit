import type {
  AuditEntry,
  ApproveRequest,
  CreateGraphEdgeRequest,
  CreateGraphNodeRequest,
  CreateSkillRequest,
  ExecutionResult,
  GraphEdgeResponse,
  GraphNodeResponse,
  ImpactAnalysisResponse,
  LineageEventResponse,
  LineageGraphResponse,
  NeighborsResponse,
  ProposalContextResponse,
  ProposalResponse,
  QuarantineEntry,
  RejectRequest,
  SkillDetailResponse,
  SkillResponse,
  WarehouseUnitResponse,
  SuggestTargetResponse,
  InsightItem,
} from "./types";

import {
  MOCK_PROPOSALS,
  MOCK_AUDIT,
  MOCK_QUARANTINE,
  MOCK_SOURCES,
  MOCK_SKILLS,
  MOCK_SKILL_DETAILS,
  MOCK_GRAPH_NODES,
  MOCK_GRAPH_EDGES,
  MOCK_LINEAGE,
  MOCK_INSIGHTS,
  MOCK_CONTEXTS,
  MOCK_SUGGEST_TARGET,
  MOCK_EXECUTION_RESULT,
  MOCK_INSIGHTS_SUMMARY,
} from "./mockData";

/* ─── Helpers ──────────────────────────────────────────────── */

/** Simulate network latency */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── Core ingest / proposals / execution ─────────────────── */

export async function ingestFile(
  _file: File,
  _targetTable: string,
  _descriptionMd?: string,
): Promise<ProposalResponse> {
  // Simulate LLM processing time
  await delay(3000);
  // Return the SCHEMA_EVOLUTION proposal for the most interesting demo
  return { ...MOCK_PROPOSALS[1] };
}

export async function suggestTargetTable(
  _file: File,
): Promise<SuggestTargetResponse> {
  await delay(1500);
  return { ...MOCK_SUGGEST_TARGET };
}

export async function listProposals(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ProposalResponse[]> {
  await delay(200);
  let result = [...MOCK_PROPOSALS];
  if (params?.status) {
    result = result.filter((p) => p.gateway_status === params.status);
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  return result.slice(offset, offset + limit);
}

export async function getProposal(id: string): Promise<ProposalResponse> {
  await delay(150);
  const found = MOCK_PROPOSALS.find((p) => p.proposal_id === id);
  if (!found) {
    throw new Error(`Proposal ${id} not found`);
  }
  return { ...found };
}

export async function getProposalContext(
  id: string,
): Promise<ProposalContextResponse> {
  await delay(200);
  const found = MOCK_CONTEXTS[id];
  if (found) return { ...found };
  // Fallback: return a generic context
  return {
    proposal_id: id,
    target_table: "orders_clean",
    context_bundle: {
      related_skills: [
        { skill_name: "pii_masking", relevance: "HIGH", reason: "PII detected" },
      ],
      related_entities: [
        { entity: "orders_clean", type: "TABLE", relationship: "target" },
      ],
      pii_columns: ["customer_email"],
      business_context: "Core transactional data from the e-commerce platform.",
      dependencies: [],
    },
    generated_at: new Date().toISOString(),
  };
}

export async function approveProposal(
  id: string,
  _body: ApproveRequest,
): Promise<ExecutionResult> {
  await delay(1200);
  return {
    ...MOCK_EXECUTION_RESULT,
    proposal_id: id,
    insights: MOCK_EXECUTION_RESULT.insights?.map((i) => ({ ...i, proposal_id: id })) ?? null,
  };
}

export async function rejectProposal(
  _id: string,
  _body: RejectRequest,
): Promise<{ status: string }> {
  await delay(500);
  return { status: "REJECTED" };
}

/* ─── Audit / Quarantine / Sources ─────────────────────────── */

export async function listAudit(
  limit = 50,
  offset = 0,
): Promise<AuditEntry[]> {
  await delay(150);
  return MOCK_AUDIT.slice(offset, offset + limit);
}

export async function listAuditForProposal(
  proposalId: string,
): Promise<AuditEntry[]> {
  await delay(150);
  return MOCK_AUDIT.filter((a) => a.proposal_id === proposalId);
}

export async function getAuditEntry(id: number): Promise<AuditEntry> {
  await delay(150);
  const found = MOCK_AUDIT.find((a) => a.id === id);
  if (!found) {
    throw new Error(`Audit entry ${id} not found`);
  }
  return { ...found };
}

export async function listQuarantine(): Promise<QuarantineEntry[]> {
  await delay(150);
  return [...MOCK_QUARANTINE];
}

export async function getQuarantineForProposal(
  proposalId: string,
): Promise<QuarantineEntry[]> {
  await delay(150);
  return MOCK_QUARANTINE.filter((q) => q.proposal_id === proposalId);
}

export async function listSources(): Promise<WarehouseUnitResponse[]> {
  await delay(100);
  return [...MOCK_SOURCES];
}

/* ─── Skills ───────────────────────────────────────────────── */

export async function listSkills(params?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<SkillResponse[]> {
  await delay(150);
  let result = [...MOCK_SKILLS];
  if (params?.category) {
    result = result.filter((s) => s.category === params.category);
  }
  if (params?.status) {
    result = result.filter((s) => s.status === params.status);
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  return result.slice(offset, offset + limit);
}

export async function searchSkills(q: string): Promise<SkillResponse[]> {
  await delay(200);
  const lower = q.toLowerCase();
  return MOCK_SKILLS.filter(
    (s) =>
      s.skill_name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      (s.use_cases && s.use_cases.toLowerCase().includes(lower)),
  );
}

export async function getSkill(id: number): Promise<SkillDetailResponse> {
  await delay(150);
  const found = MOCK_SKILL_DETAILS[id];
  if (!found) {
    throw new Error(`Skill ${id} not found`);
  }
  return { ...found };
}

export async function createSkill(
  body: CreateSkillRequest,
): Promise<SkillResponse> {
  await delay(500);
  return {
    id: MOCK_SKILLS.length + 1,
    skill_name: body.skill_name,
    version: body.version ?? "1.0.0",
    category: body.category,
    description: body.description,
    use_cases: body.use_cases ?? null,
    constraints: body.constraints ?? null,
    owner: body.owner ?? null,
    status: body.status ?? "DRAFT",
    created_at: new Date().toISOString(),
  };
}

/* ─── Graph ────────────────────────────────────────────────── */

export async function listGraphNodes(params?: {
  node_type?: string;
  limit?: number;
  offset?: number;
}): Promise<GraphNodeResponse[]> {
  await delay(150);
  let result = [...MOCK_GRAPH_NODES];
  if (params?.node_type) {
    result = result.filter((n) => n.node_type === params.node_type);
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 100;
  return result.slice(offset, offset + limit);
}

export async function listGraphEdges(params?: {
  relation_type?: string;
  limit?: number;
  offset?: number;
}): Promise<GraphEdgeResponse[]> {
  await delay(150);
  let result = [...MOCK_GRAPH_EDGES];
  if (params?.relation_type) {
    result = result.filter((e) => e.relation_type === params.relation_type);
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 100;
  return result.slice(offset, offset + limit);
}

export async function getGraphLineage(
  entity: string,
  _maxDepth = 5,
): Promise<LineageGraphResponse> {
  await delay(300);
  // Find the starting node
  const startNode = MOCK_GRAPH_NODES.find(
    (n) =>
      n.entity_name?.toLowerCase() === entity.toLowerCase() ||
      n.entity_id?.toLowerCase() === entity.toLowerCase(),
  );
  if (!startNode) {
    return { nodes: [], edges: [] };
  }

  // BFS forward from the start node
  const visited = new Set<number>([startNode.id]);
  const queue = [startNode.id];
  const reachableNodes: GraphNodeResponse[] = [startNode];
  const reachableEdges: GraphEdgeResponse[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of MOCK_GRAPH_EDGES) {
      if (edge.source_node_id === current && !visited.has(edge.target_node_id)) {
        visited.add(edge.target_node_id);
        queue.push(edge.target_node_id);
        reachableEdges.push(edge);
        const targetNode = MOCK_GRAPH_NODES.find((n) => n.id === edge.target_node_id);
        if (targetNode) reachableNodes.push(targetNode);
      }
    }
  }

  return { nodes: reachableNodes, edges: reachableEdges };
}

export async function getGraphImpact(
  entity: string,
): Promise<ImpactAnalysisResponse> {
  await delay(300);
  const startNode = MOCK_GRAPH_NODES.find(
    (n) =>
      n.entity_name?.toLowerCase() === entity.toLowerCase() ||
      n.entity_id?.toLowerCase() === entity.toLowerCase(),
  );
  if (!startNode) {
    return { entity, start_nodes: [], impacted_nodes: [], total_impacted: 0 };
  }

  // BFS reverse — who depends on this entity?
  const visited = new Set<number>([startNode.id]);
  const impacted: ImpactAnalysisResponse["impacted_nodes"] = [];

  const queue: Array<{ nodeId: number; depth: number; path: string[] }> = [
    { nodeId: startNode.id, depth: 0, path: [startNode.entity_name ?? ""] },
  ];

  while (queue.length > 0) {
    const { nodeId, depth, path } = queue.shift()!;
    for (const edge of MOCK_GRAPH_EDGES) {
      if (edge.target_node_id === nodeId && !visited.has(edge.source_node_id)) {
        visited.add(edge.source_node_id);
        const sourceNode = MOCK_GRAPH_NODES.find((n) => n.id === edge.source_node_id);
        if (sourceNode) {
          const newPath = [...path, sourceNode.entity_name ?? ""];
          impacted.push({
            node: sourceNode,
            depth: depth + 1,
            relation_type: edge.relation_type ?? "UNKNOWN",
            path: newPath,
          });
          queue.push({ nodeId: sourceNode.id, depth: depth + 1, path: newPath });
        }
      }
    }
  }

  return {
    entity,
    start_nodes: [startNode],
    impacted_nodes: impacted,
    total_impacted: impacted.length,
  };
}

export async function getGraphNeighbors(
  nodeId: number,
): Promise<NeighborsResponse> {
  await delay(150);
  const neighbors: NeighborsResponse["neighbors"] = [];

  for (const edge of MOCK_GRAPH_EDGES) {
    if (edge.source_node_id === nodeId) {
      const target = MOCK_GRAPH_NODES.find((n) => n.id === edge.target_node_id);
      if (target) {
        neighbors.push({
          direction: "out",
          relation_type: edge.relation_type,
          confidence_score: edge.confidence_score ?? 1.0,
          node: target,
        });
      }
    }
    if (edge.target_node_id === nodeId) {
      const source = MOCK_GRAPH_NODES.find((n) => n.id === edge.source_node_id);
      if (source) {
        neighbors.push({
          direction: "in",
          relation_type: edge.relation_type,
          confidence_score: edge.confidence_score ?? 1.0,
          node: source,
        });
      }
    }
  }

  return { node_id: nodeId, neighbors, total: neighbors.length };
}

export async function createGraphNode(
  body: CreateGraphNodeRequest,
): Promise<GraphNodeResponse> {
  await delay(300);
  return {
    id: MOCK_GRAPH_NODES.length + 1,
    node_type: body.node_type,
    entity_id: body.entity_id,
    entity_name: body.entity_name ?? null,
    metadata: body.metadata ?? null,
  };
}

export async function createGraphEdge(
  body: CreateGraphEdgeRequest,
): Promise<GraphEdgeResponse> {
  await delay(300);
  return {
    id: MOCK_GRAPH_EDGES.length + 1,
    source_node_id: body.source_node_id,
    target_node_id: body.target_node_id,
    relation_type: body.relation_type,
    confidence_score: body.confidence_score,
    created_at: new Date().toISOString(),
  };
}

/* ─── Lineage ──────────────────────────────────────────────── */

export async function listLineage(params?: {
  limit?: number;
  offset?: number;
}): Promise<LineageEventResponse[]> {
  await delay(150);
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  return MOCK_LINEAGE.slice(offset, offset + limit);
}

export async function getLineageForProposal(
  proposalId: string,
): Promise<LineageEventResponse[]> {
  await delay(150);
  return MOCK_LINEAGE.filter((l) => l.proposal_id === proposalId);
}

/* ─── Insights ─────────────────────────────────────────────── */

export async function listInsights(params?: {
  category?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<InsightItem[]> {
  await delay(150);
  let result = [...MOCK_INSIGHTS];
  if (params?.category) {
    result = result.filter((i) => i.category === params.category);
  }
  if (params?.severity) {
    result = result.filter((i) => i.severity === params.severity);
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  return result.slice(offset, offset + limit);
}

export async function getInsightsForProposal(
  proposalId: string,
): Promise<InsightItem[]> {
  await delay(150);
  return MOCK_INSIGHTS.filter((i) => i.proposal_id === proposalId);
}

export async function getInsightsSummary(): Promise<{
  total: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  recent_critical: InsightItem[];
}> {
  await delay(200);
  return { ...MOCK_INSIGHTS_SUMMARY };
}
