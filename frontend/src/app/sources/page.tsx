"use client";

import { useEffect, useState } from "react";
import { listSources } from "@/lib/api";
import type { WarehouseUnitResponse } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/badges";

export default function SourcesPage() {
  const [sources, setSources] = useState<WarehouseUnitResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSources()
      .then(setSources)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const connected = sources?.filter((s) => s.status === "CONNECTED").length ?? 0;
  const total = sources?.length ?? 0;

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Sources"
        description="Registered warehouse units. The system performs a live SELECT 1 against each to determine connectivity before any execution."
      />

      {error ? (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Total sources
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {total || "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Connected
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-success">
            {sources === null ? "—" : connected}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Unreachable
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-danger">
            {sources === null ? "—" : total - connected}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="text-sm font-semibold">All sources</h3>
        </div>
        {sources === null ? (
          <div className="panel-body space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-bg-subtle anim-fade" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="panel-body text-sm text-fg-muted">
            No sources registered.
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="font-mono text-2xs text-fg-muted">
                    {s.unit_type}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <StatusDot status={s.status} />
                      {s.status}
                    </span>
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
