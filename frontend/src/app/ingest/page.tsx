"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ingestFile } from "@/lib/api";
import type { ProposalResponse } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { GatewayBadge } from "@/components/badges";
import { formatBytes } from "@/lib/format";

export default function IngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [targetTable, setTargetTable] = useState("orders_clean");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
      setProposal(null);
    }
  }, []);

  const onSelect = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setProposal(null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file to ingest.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = await ingestFile(file, targetTable);
      setProposal(p);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setProposal(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-8 anim-fade">
      <PageHeader
        title="Ingest"
        description="Upload a data file. The agent will detect schema drift, generate a transformation plan, and submit a proposal for your review."
      />

      {!proposal ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div>
              <label className="label">Source file</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={clsx(
                  "rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  dragging
                    ? "border-fg bg-bg-subtle"
                    : "border-border hover:border-fg-subtle hover:bg-bg-subtle",
                  "px-6 py-12 text-center",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-2xs text-fg-muted font-mono">
                      {formatBytes(file.size)} · {file.type || "application/octet-stream"}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="text-2xs text-fg-muted hover:text-fg underline mt-2"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-fg">
                      Drop your file here
                    </div>
                    <div className="text-2xs text-fg-muted">
                      or click to browse · CSV or JSON · up to 50MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="target_table">
                Target table
              </label>
              <input
                id="target_table"
                type="text"
                className="input font-mono"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder="e.g. orders_clean"
              />
              <p className="mt-1.5 text-2xs text-fg-muted">
                The registered table in the conduit metadata store
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={!file || loading}
              >
                {loading ? "Generating proposal…" : "Generate proposal"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn-ghost"
                disabled={loading}
              >
                Reset
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">How it works</h3>
              </div>
              <ol className="panel-body text-sm text-fg-muted space-y-2 list-decimal list-inside">
                <li>Schema detection on the uploaded file</li>
                <li>Comparison against target metadata</li>
                <li>
                  AI generates a transformation plan and a gateway
                  classification
                </li>
                <li>Generated code is AST-validated for safety</li>
                <li>You review and approve the proposal</li>
              </ol>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">Try the demo files</h3>
              </div>
              <ul className="panel-body text-2xs font-mono text-fg-muted space-y-1.5">
                <li>db/demo_csvs/clean_orders.csv</li>
                <li>db/demo_csvs/drifted_orders.csv</li>
                <li>db/demo_csvs/conflicted_orders.csv</li>
              </ul>
            </div>
          </aside>
        </form>
      ) : (
        <ProposalReview proposal={proposal} onReset={reset} />
      )}
    </div>
  );
}

function ProposalReview({
  proposal,
  onReset,
}: {
  proposal: ProposalResponse;
  onReset: () => void;
}) {
  const confidencePct = Math.round(proposal.confidence_score * 100);
  const confidenceColor =
    proposal.confidence_score > 0.9
      ? "text-success"
      : proposal.confidence_score > 0.75
      ? "text-warning"
      : "text-danger";

  return (
    <div className="space-y-6 anim-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Proposal review
            </h2>
            <GatewayBadge status={proposal.gateway_status} />
          </div>
          <p className="text-2xs text-fg-muted font-mono">
            {proposal.proposal_id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="btn-secondary">
            Start over
          </button>
          <Link
            href={`/proposals/${proposal.proposal_id}`}
            className="btn-primary"
          >
            Open detail view →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Confidence
          </div>
          <div className={clsx("mt-2 text-2xl font-semibold tabular-nums", confidenceColor)}>
            {confidencePct}%
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
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Drift items
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {proposal.drift_detected.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Estimated rows
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {proposal.estimated_rows.toLocaleString()}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            PII columns
          </div>
          <div className="mt-2 text-sm font-medium truncate">
            {proposal.pii_columns_found.length === 0
              ? "None detected"
              : proposal.pii_columns_found.join(", ")}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="text-sm font-semibold">Drift detected</h3>
          <span className="text-2xs text-fg-muted font-mono">
            {proposal.drift_detected.length} items
          </span>
        </div>
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
                  <td className="text-fg-muted text-2xs font-mono">
                    {d.source_value || "—"}
                  </td>
                  <td className="text-fg-muted text-2xs font-mono">
                    {d.target_expectation || "—"}
                  </td>
                  <td className="text-sm">{d.suggested_action}</td>
                  <td>
                    <span
                      className={clsx(
                        "badge uppercase tracking-wider",
                        d.severity === "HIGH" &&
                          "text-danger bg-danger-bg border-danger-border",
                        d.severity === "MEDIUM" &&
                          "text-warning bg-warning-bg border-warning-border",
                        d.severity === "LOW" &&
                          "text-fg-muted bg-bg-subtle border-border",
                      )}
                    >
                      {d.severity}
                    </span>
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
    </div>
  );
}
