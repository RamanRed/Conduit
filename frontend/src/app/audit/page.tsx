"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAudit } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ExecutionBadge } from "@/components/badges";
import { formatRelative } from "@/lib/format";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  useEffect(() => {
    listAudit(200)
      .then(setEntries)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const filtered =
    entries?.filter((e) => {
      if (filter === "success") return e.execution_status === "SUCCESS";
      if (filter === "failed")
        return (
          e.execution_status === "FAILED" || e.execution_status === "ROLLEDBACK"
        );
      return true;
    }) ?? null;

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Audit"
        description="Immutable ledger of every pipeline execution. The why log: what the AI saw, what it generated, who approved it."
      />

      {error ? (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "success", label: "Success" },
                { key: "failed", label: "Failed" },
              ] as { key: "all" | "success" | "failed"; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  filter === f.key
                    ? "btn-secondary h-7 px-2.5 text-2xs"
                    : "btn-ghost h-7 px-2.5 text-2xs"
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-2xs text-fg-muted font-mono">
            {filtered?.length ?? "—"} entries
          </span>
        </div>

        {entries === null ? (
          <div className="panel-body space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-bg-subtle anim-fade" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <table className="table-base">
            <thead>
              <tr>
                <th>ID</th>
                <th>File</th>
                <th>Skill</th>
                <th>Status</th>
                <th>Approver</th>
                <th>Executed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-2xs text-fg-muted">
                    #{a.id}
                  </td>
                  <td>
                    <Link
                      href={`/audit/${a.id}`}
                      className="font-mono text-2xs hover:underline"
                    >
                      {a.filename}
                    </Link>
                  </td>
                  <td className="font-mono text-2xs text-fg-muted">
                    {a.skill_name}
                  </td>
                  <td>
                    <ExecutionBadge status={a.execution_status} />
                  </td>
                  <td className="text-fg-muted">{a.human_approver_id}</td>
                  <td className="text-2xs text-fg-muted">
                    {formatRelative(a.executed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="panel-body text-sm text-fg-muted">
            No entries match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
