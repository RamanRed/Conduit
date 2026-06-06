"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listAudit,
  listQuarantine,
  listSources,
  listAudit as _listAudit,
} from "@/lib/api";
import type {
  AuditEntry,
  QuarantineEntry,
  WarehouseUnitResponse,
} from "@/lib/types";
import { GatewayBadge, ExecutionBadge, StatusDot } from "@/components/badges";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/format";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-2xs text-fg-muted">{hint}</div> : null}
    </div>
  );
}

export default function OverviewPage() {
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineEntry[] | null>(null);
  const [sources, setSources] = useState<WarehouseUnitResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAudit(20), listQuarantine(), listSources()])
      .then(([a, q, s]) => {
        if (cancelled) return;
        setAudit(a);
        setQuarantine(q);
        setSources(s);
      })
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = audit === null || quarantine === null || sources === null;

  const successCount = audit?.filter((a) => a.execution_status === "SUCCESS").length ?? 0;
  const failedCount = audit?.filter(
    (a) => a.execution_status === "FAILED" || a.execution_status === "ROLLEDBACK",
  ).length ?? 0;
  const totalWritten = audit?.reduce((sum, a) => sum + 0, 0) ?? 0; // aggregated separately
  const connectedSources = sources?.filter((s) => s.status === "CONNECTED").length ?? 0;
  const totalSources = sources?.length ?? 0;

  return (
    <div className="space-y-8 anim-fade">
      <PageHeader
        title="Overview"
        description="Operational status of the data engineering pipeline. Schema drift, execution health, and source connectivity in one view."
        actions={
          <Link href="/ingest" className="btn-primary">
            New Ingest
          </Link>
        }
      />

      {error ? (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          Failed to load overview: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Executions"
          value={loading ? "—" : audit!.length}
          hint="Total in audit ledger"
        />
        <StatCard
          label="Successful"
          value={loading ? "—" : successCount}
          hint="Status: SUCCESS"
        />
        <StatCard
          label="Failed"
          value={loading ? "—" : failedCount}
          hint="Status: FAILED / ROLLEDBACK"
        />
        <StatCard
          label="Quarantined rows"
          value={loading ? "—" : quarantine!.length}
          hint="Failed inserts awaiting review"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 panel">
          <div className="panel-header">
            <div>
              <h3 className="text-sm font-semibold">Recent executions</h3>
              <p className="text-2xs text-fg-muted mt-0.5">
                Latest activity from the pipeline ledger
              </p>
            </div>
            <Link href="/audit" className="btn-ghost h-7 px-2 text-2xs">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="panel-body space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-bg-subtle anim-fade" />
              ))}
            </div>
          ) : audit && audit.length > 0 ? (
            <table className="table-base">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Skill</th>
                  <th>Status</th>
                  <th>Approver</th>
                  <th className="text-right">Executed</th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 8).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link
                        href={`/audit/${a.id}`}
                        className="font-mono text-2xs text-fg hover:underline"
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
                    <td className="text-right text-fg-muted text-2xs">
                      {formatRelative(a.executed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="panel-body text-sm text-fg-muted">
              No executions yet. Start by ingesting a file.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="text-sm font-semibold">Sources</h3>
              <p className="text-2xs text-fg-muted mt-0.5">
                {connectedSources} of {totalSources} connected
              </p>
            </div>
            <Link href="/sources" className="btn-ghost h-7 px-2 text-2xs">
              Manage →
            </Link>
          </div>
          {loading ? (
            <div className="panel-body space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-bg-subtle anim-fade" />
              ))}
            </div>
          ) : sources && sources.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.name}
                    </div>
                    <div className="text-2xs text-fg-muted font-mono">
                      {s.unit_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <StatusDot status={s.status} />
                    {s.status}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-body text-sm text-fg-muted">
              No sources registered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
