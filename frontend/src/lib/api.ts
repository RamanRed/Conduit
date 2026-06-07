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
} from "./types";

const API_BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const err = new Error(
      `API ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
    );
    (err as Error & { status?: number; detail?: unknown }).status = res.status;
    (err as Error & { status?: number; detail?: unknown }).detail = detail;
    throw err;
  }
  return res.json() as Promise<T>;
}

/* ─── Core ingest / proposals / execution ─────────────────── */

export async function ingestFile(
  file: File,
  targetTable: string,
): Promise<ProposalResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("target_table", targetTable);
  const res = await fetch(`${API_BASE}/ingest`, {
    method: "POST",
    body: form,
  });
  return handle<ProposalResponse>(res);
}

export async function listProposals(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ProposalResponse[]> {
  const q = new URLSearchParams();
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return handle<ProposalResponse[]>(
    await fetch(`${API_BASE}/proposals${qs ? `?${qs}` : ""}`),
  );
}

export async function getProposal(id: string): Promise<ProposalResponse> {
  return handle<ProposalResponse>(
    await fetch(`${API_BASE}/proposals/${id}`),
  );
}

export async function getProposalContext(
  id: string,
): Promise<ProposalContextResponse> {
  return handle<ProposalContextResponse>(
    await fetch(`${API_BASE}/proposals/${id}/context`),
  );
}

export async function approveProposal(
  id: string,
  body: ApproveRequest,
): Promise<ExecutionResult> {
  return handle<ExecutionResult>(
    await fetch(`${API_BASE}/proposals/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function rejectProposal(
  id: string,
  body: RejectRequest,
): Promise<{ status: string }> {
  return handle<{ status: string }>(
    await fetch(`${API_BASE}/proposals/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/* ─── Audit / Quarantine / Sources ─────────────────────────── */

export async function listAudit(
  limit = 50,
  offset = 0,
): Promise<AuditEntry[]> {
  return handle<AuditEntry[]>(
    await fetch(`${API_BASE}/audit?limit=${limit}&offset=${offset}`),
  );
}

export async function listAuditForProposal(
  proposalId: string,
): Promise<AuditEntry[]> {
  return handle<AuditEntry[]>(
    await fetch(
      `${API_BASE}/audit?proposal_id=${encodeURIComponent(proposalId)}`,
    ),
  );
}

export async function getAuditEntry(id: number): Promise<AuditEntry> {
  return handle<AuditEntry>(await fetch(`${API_BASE}/audit/${id}`));
}

export async function listQuarantine(): Promise<QuarantineEntry[]> {
  return handle<QuarantineEntry[]>(
    await fetch(`${API_BASE}/quarantine`),
  );
}

export async function getQuarantineForProposal(
  proposalId: string,
): Promise<QuarantineEntry[]> {
  return handle<QuarantineEntry[]>(
    await fetch(`${API_BASE}/quarantine/${proposalId}`),
  );
}

export async function listSources(): Promise<WarehouseUnitResponse[]> {
  return handle<WarehouseUnitResponse[]>(await fetch(`${API_BASE}/sources`));
}

/* ─── Skills ───────────────────────────────────────────────── */

export async function listSkills(params?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<SkillResponse[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.status) q.set("status", params.status);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return handle<SkillResponse[]>(
    await fetch(`${API_BASE}/skills${qs ? `?${qs}` : ""}`),
  );
}

export async function searchSkills(q: string): Promise<SkillResponse[]> {
  return handle<SkillResponse[]>(
    await fetch(`${API_BASE}/skills/search?q=${encodeURIComponent(q)}`),
  );
}

export async function getSkill(id: number): Promise<SkillDetailResponse> {
  return handle<SkillDetailResponse>(
    await fetch(`${API_BASE}/skills/${id}`),
  );
}

export async function createSkill(
  body: CreateSkillRequest,
): Promise<SkillResponse> {
  return handle<SkillResponse>(
    await fetch(`${API_BASE}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/* ─── Graph ────────────────────────────────────────────────── */

export async function listGraphNodes(params?: {
  node_type?: string;
  limit?: number;
  offset?: number;
}): Promise<GraphNodeResponse[]> {
  const q = new URLSearchParams();
  if (params?.node_type) q.set("node_type", params.node_type);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return handle<GraphNodeResponse[]>(
    await fetch(`${API_BASE}/graph/nodes${qs ? `?${qs}` : ""}`),
  );
}

export async function listGraphEdges(params?: {
  relation_type?: string;
  limit?: number;
  offset?: number;
}): Promise<GraphEdgeResponse[]> {
  const q = new URLSearchParams();
  if (params?.relation_type) q.set("relation_type", params.relation_type);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return handle<GraphEdgeResponse[]>(
    await fetch(`${API_BASE}/graph/edges${qs ? `?${qs}` : ""}`),
  );
}

export async function getGraphLineage(
  entity: string,
  maxDepth = 5,
): Promise<LineageGraphResponse> {
  return handle<LineageGraphResponse>(
    await fetch(
      `${API_BASE}/graph/lineage/${encodeURIComponent(entity)}?max_depth=${maxDepth}`,
    ),
  );
}

export async function getGraphImpact(
  entity: string,
): Promise<ImpactAnalysisResponse> {
  return handle<ImpactAnalysisResponse>(
    await fetch(`${API_BASE}/graph/impact/${encodeURIComponent(entity)}`),
  );
}

export async function getGraphNeighbors(
  nodeId: number,
): Promise<NeighborsResponse> {
  return handle<NeighborsResponse>(
    await fetch(`${API_BASE}/graph/neighbors/${nodeId}`),
  );
}

export async function createGraphNode(
  body: CreateGraphNodeRequest,
): Promise<GraphNodeResponse> {
  return handle<GraphNodeResponse>(
    await fetch(`${API_BASE}/graph/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function createGraphEdge(
  body: CreateGraphEdgeRequest,
): Promise<GraphEdgeResponse> {
  return handle<GraphEdgeResponse>(
    await fetch(`${API_BASE}/graph/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/* ─── Lineage ──────────────────────────────────────────────── */

export async function listLineage(params?: {
  limit?: number;
  offset?: number;
}): Promise<LineageEventResponse[]> {
  const q = new URLSearchParams();
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return handle<LineageEventResponse[]>(
    await fetch(`${API_BASE}/lineage${qs ? `?${qs}` : ""}`),
  );
}

export async function getLineageForProposal(
  proposalId: string,
): Promise<LineageEventResponse[]> {
  return handle<LineageEventResponse[]>(
    await fetch(`${API_BASE}/lineage/${proposalId}`),
  );
}
