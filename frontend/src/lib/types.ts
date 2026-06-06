export type GatewayStatus = "AUTO_LINK" | "SCHEMA_EVOLUTION" | "CONFLICT";
export type IssueType =
  | "RENAME"
  | "EXTRA_COLUMN"
  | "TYPE_MISMATCH"
  | "NULL_VIOLATION"
  | "MISSING_REQUIRED";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type ProposalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "FAILED";

export interface DriftItem {
  column: string;
  issue_type: IssueType;
  source_value: string;
  target_expectation: string;
  suggested_action: string;
  severity: Severity;
}

export interface ProposalResponse {
  proposal_id: string;
  gateway_status: GatewayStatus;
  drift_detected: DriftItem[];
  proposed_steps: string[];
  generated_code: string;
  confidence_score: number;
  pii_columns_found: string[];
  estimated_rows: number;
  llm_model_used: string;
}

export interface ExecutionResult {
  proposal_id: string;
  rows_written: number;
  rows_quarantined: number;
  execution_status: string;
  duration_ms: number;
}

export interface AuditEntry {
  id: number;
  proposal_id: string;
  filename: string;
  skill_name: string;
  execution_status: string;
  human_approver_id: string;
  executed_at: string;
  llm_prompt_sent: string;
  llm_raw_response: string;
  transformation_script_ref: string;
}

export interface QuarantineEntry {
  id: number;
  proposal_id: string;
  raw_row: Record<string, unknown>;
  failure_reason: string;
  quarantined_at: string;
}

export interface WarehouseUnitResponse {
  id: number;
  name: string;
  unit_type: string;
  status: "CONNECTED" | "UNREACHABLE";
}

export interface ApproveRequest {
  human_approver_id: string;
}

export interface RejectRequest {
  reason: string;
}
