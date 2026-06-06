"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  approveProposal,
  getAuditEntry,
  getProposal,
  rejectProposal,
} from "@/lib/api";
import type {
  AuditEntry,
  ExecutionResult,
  ProposalResponse,
} from "@/lib/types";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { GatewayBadge, SeverityBadge } from "@/components/badges";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { formatBytes, formatRelative } from "@/lib/format";

type Tab = "drift" | "code" | "prompt";

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("drift");

  const [approver, setApprover] = useState("demo_engineer_01");
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(
    null,
  );
  const [actionResult, setActionResult] = useState<ExecutionResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!id) return;
    getProposal(id)
      .then(setProposal)
      .catch((e) => setError(String(e.message ?? e)));
  }, [id]);

  // Try to find a matching audit entry by proposal id (best effort)
  useEffect(() => {
    if (!id) return;
    // Heuristic: scan common IDs in a small range to find a match
    async function tryFetch() {
      for (let i = 1; i <= 50; i++) {
        try {
          const a = await getAuditEntry(i);
          if (a.proposal_id === id) {
            setAudit(a);
            return;
          }
        } catch {
          // ignore
        }
      }
    }
    tryFetch();
  }, [id]);

  async function handleApprove() {
    if (!id) return;
    setActionLoading("approve");
    setActionError(null);
    try {
      const res = await approveProposal(id, { human_approver_id: approver });
      setActionResult(res);
      // Re-fetch audit entry to update state
      if (res.proposal_id) {
        for (let i = 1; i <= 50; i++) {
          try {
            const a = await getAuditEntry(i);
            if (a.proposal_id === res.proposal_id) {
              setAudit(a);
              break;
            }
          } catch {}
        }
      }
    } catch (e) {
      setActionError(String((e as Error).message ?? e));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!id) return;
    setActionLoading("reject");
    setActionError(null);
    try {
      await rejectProposal(id, { reason: rejectReason || "Rejected by engineer" });
      router.push("/proposals");
    } catch (e) {
      setActionError(String((e as Error).message ?? e));
      setActionLoading(null);
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Proposal" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loading proposal…" />
        <div className="h-32 rounded-lg bg-bg-subtle anim-fade" />
      </div>
    );
  }

  const confidencePct = Math.round(proposal.confidence_score * 100);

  return (
    <div className="space-y-6 anim-fade">
      <div className="space-y-3">
        <Link
          href="/proposals"
          className="text-2xs text-fg-muted hover:text-fg inline-flex items-center gap-1"
        >
          ← Proposals
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                Proposal
              </h1>
              <GatewayBadge status={proposal.gateway_status} />
            </div>
            <p className="mt-1 text-2xs text-fg-muted font-mono">
              {proposal.proposal_id}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <div className="panel">
            <div className="border-b border-border-subtle px-1 py-1 flex items-center gap-0.5">
              {(
                [
                  { key: "drift", label: "Drift" },
                  { key: "code", label: "Generated code" },
                  { key: "prompt", label: "AI prompt" },
                ] as { key: Tab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    "px-3 h-8 text-sm rounded-md transition-colors",
                    tab === t.key
                      ? "bg-bg-subtle text-fg font-medium"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "drift" && (
              <div>
                {proposal.drift_detected.length > 0 ? (
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Issue</th>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Action</th>
                        <th>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.drift_detected.map((d, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs">{d.column}</td>
                          <td>
                            <span className="badge text-2xs font-mono uppercase tracking-wider bg-bg-subtle border-border text-fg-muted">
                              {d.issue_type}
                            </span>
                          </td>
                          <td className="text-fg-muted text-2xs font-mono max-w-xs truncate">
                            {d.source_value || "—"}
                          </td>
                          <td className="text-fg-muted text-2xs font-mono max-w-xs truncate">
                            {d.target_expectation || "—"}
                          </td>
                          <td className="text-sm max-w-md">
                            {d.suggested_action}
                          </td>
                          <td>
                            <SeverityBadge severity={d.severity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="panel-body text-sm text-fg-muted">
                    No drift detected. The incoming schema matches the target.
                  </div>
                )}
              </div>
            )}

            {tab === "code" && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xs text-fg-muted">
                    AST-validated · executes in a restricted namespace
                  </div>
                  <CopyButton value={proposal.generated_code} />
                </div>
                <CodeBlock
                  code={proposal.generated_code}
                  language="python"
                  maxHeight="max-h-[60vh]"
                />
              </div>
            )}

            {tab === "prompt" && (
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-medium">User message</div>
                    <CopyButton
                      value={
                        audit?.llm_prompt_sent ??
                        "(no execution record — approve the proposal to capture the prompt)"
                      }
                    />
                  </div>
                  <CodeBlock
                    code={
                      audit?.llm_prompt_sent ??
                      "(no execution record yet — approve the proposal to capture the prompt)"
                    }
                    language="text"
                    maxHeight="max-h-[60vh]"
                  />
                </div>
                {audit?.llm_raw_response ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-medium">Raw LLM response</div>
                      <CopyButton value={audit.llm_raw_response} />
                    </div>
                    <CodeBlock
                      code={audit.llm_raw_response}
                      language="json"
                      maxHeight="max-h-[40vh]"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {actionResult ? (
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">Execution result</h3>
                <span className="text-2xs text-fg-muted font-mono">
                  {actionResult.execution_status}
                </span>
              </div>
              <div className="panel-body grid grid-cols-3 gap-6">
                <div>
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Rows written
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {actionResult.rows_written.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Rows quarantined
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {actionResult.rows_quarantined.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Duration
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {actionResult.duration_ms}ms
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="col-span-4 space-y-4">
          <div className="card p-4 space-y-3">
            <div>
              <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                Confidence
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={clsx(
                    "text-2xl font-semibold tabular-nums",
                    proposal.confidence_score > 0.9
                      ? "text-success"
                      : proposal.confidence_score > 0.75
                      ? "text-warning"
                      : "text-danger",
                  )}
                >
                  {confidencePct}%
                </span>
                <span className="text-2xs text-fg-muted">
                  {proposal.llm_model_used}
                </span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-bg-subtle overflow-hidden">
                <div
                  className={clsx(
                    "h-full",
                    proposal.confidence_score > 0.9
                      ? "bg-success"
                      : proposal.confidence_score > 0.75
                      ? "bg-warning"
                      : "bg-danger",
                  )}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            <div className="divider" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Estimated rows</dt>
                <dd className="font-mono tabular-nums">
                  {proposal.estimated_rows.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Drift items</dt>
                <dd className="font-mono tabular-nums">
                  {proposal.drift_detected.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">PII columns</dt>
                <dd className="font-mono text-2xs">
                  {proposal.pii_columns_found.length === 0
                    ? "—"
                    : proposal.pii_columns_found.join(", ")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Proposed steps</div>
              <div className="text-2xs text-fg-muted mt-0.5">
                Plain-English action plan from the AI
              </div>
            </div>
            {proposal.proposed_steps.length > 0 ? (
              <ol className="space-y-1.5 text-sm list-decimal list-inside text-fg">
                {proposal.proposed_steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-fg-muted">No steps proposed.</div>
            )}
          </div>

          {proposal.gateway_status === "CONFLICT" ? (
            <div className="card p-4 border-danger-border bg-danger-bg space-y-2">
              <div className="text-sm font-semibold text-danger">
                Conflict — manual review required
              </div>
              <p className="text-2xs text-fg-muted leading-relaxed">
                The agent detected drift that cannot be auto-resolved.
                Approve only if you have manually verified the generated
                transformation.
              </p>
            </div>
          ) : null}

          {audit ? (
            <div className="card p-4 space-y-2">
              <div className="text-sm font-semibold">Execution</div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-2xs text-fg-muted">Status</dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {audit.execution_status}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-fg-muted">Approver</dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {audit.human_approver_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-fg-muted">Executed</dt>
                  <dd className="text-xs mt-0.5">
                    {formatRelative(audit.executed_at)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="card p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold">Approve & execute</div>
                <div className="text-2xs text-fg-muted mt-0.5">
                  Trigger the transformation against the warehouse
                </div>
              </div>
              <div>
                <label className="label">Approver ID</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  placeholder="e.g. demo_engineer_01"
                />
              </div>
              {actionError ? (
                <div className="text-2xs text-danger border border-danger-border bg-danger-bg rounded p-2">
                  {actionError}
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading !== null}
                  className="btn-primary w-full"
                >
                  {actionLoading === "approve" ? "Executing…" : "Approve & execute"}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading !== null}
                  className="btn-secondary w-full"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRejectModal ? (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 anim-fade"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card p-5 w-full max-w-md space-y-3"
          >
            <div>
              <h3 className="text-sm font-semibold">Reject proposal</h3>
              <p className="text-2xs text-fg-muted mt-0.5">
                The reason will be stored in the audit ledger.
              </p>
            </div>
            <textarea
              className="input min-h-24 py-2 h-auto"
              placeholder="Why are you rejecting this proposal?"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading !== null}
                className="btn-danger"
              >
                {actionLoading === "reject" ? "Rejecting…" : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
