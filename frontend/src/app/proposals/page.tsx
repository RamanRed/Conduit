"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAudit } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { ExecutionBadge } from "@/components/badges";
import { formatRelative } from "@/lib/format";

export default function ProposalsPage() {
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAudit(100)
      .then(setAudit)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Proposals"
        description="All proposals that have been processed by the pipeline ledger. Click any entry to inspect the full execution record, AI prompt, and raw response."
      />

      {error ? (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header">
          <h3 className="text-sm font-semibold">All proposals</h3>
          <span className="text-2xs text-fg-muted font-mono">
            {audit?.length ?? "—"} entries
          </span>
        </div>
        {audit === null ? (
          <div className="panel-body space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-bg-subtle anim-fade" />
            ))}
          </div>
        ) : audit.length === 0 ? (
          <div className="panel-body text-sm text-fg-muted">
            No proposals yet.{" "}
            <Link href="/ingest" className="text-fg underline">
              Ingest a file
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Proposal ID</th>
                <th>File</th>
                <th>Status</th>
                <th>Approver</th>
                <th>Executed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-2xs text-fg-muted">
                    {a.proposal_id.slice(0, 8)}…
                  </td>
                  <td>
                    <Link
                      href={`/audit/${a.id}`}
                      className="font-mono text-2xs hover:underline"
                    >
                      {a.filename}
                    </Link>
                  </td>
                  <td>
                    <ExecutionBadge status={a.execution_status} />
                  </td>
                  <td className="text-fg-muted">{a.human_approver_id}</td>
                  <td className="text-2xs text-fg-muted">
                    {formatRelative(a.executed_at)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/audit/${a.id}`}
                      className="text-2xs text-fg-muted hover:text-fg"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
