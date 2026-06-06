import type {
  AuditEntry,
  ApproveRequest,
  ExecutionResult,
  ProposalResponse,
  QuarantineEntry,
  RejectRequest,
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

export async function getProposal(id: string): Promise<ProposalResponse> {
  return handle<ProposalResponse>(
    await fetch(`${API_BASE}/proposals/${id}`),
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

export async function listAudit(
  limit = 50,
  offset = 0,
): Promise<AuditEntry[]> {
  return handle<AuditEntry[]>(
    await fetch(`${API_BASE}/audit?limit=${limit}&offset=${offset}`),
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
