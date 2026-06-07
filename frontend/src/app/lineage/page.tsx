"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { listLineage } from "@/lib/api";
import type { LineageEventResponse } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatRelative } from "@/lib/format";

const OPERATION_COLORS: Record<string, string> = {
  INGEST: "text-info bg-info-bg border-info-border",
  TRANSFORM: "text-success bg-success-bg border-success-border",
  VALIDATE: "text-warning bg-warning-bg border-warning-border",
  QUARANTINE: "text-danger bg-danger-bg border-danger-border",
  EVOLVE: "text-warning bg-warning-bg border-warning-border",
};

function OperationBadge({ op }: { op: string | null | undefined }) {
  const o = op ?? "UNKNOWN";
  const color =
    OPERATION_COLORS[o] ?? "text-fg-muted bg-bg-subtle border-border";
  return (
    <span className={clsx("badge uppercase tracking-wider font-mono", color)}>
      {o.replace(/_/g, " ")}
    </span>
  );
}

export default function LineagePage() {
  const [events, setEvents] = useState<LineageEventResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [operationFilter, setOperationFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    listLineage({ limit: 200 })
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
      })
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const operationTypes = useMemo(() => {
    if (!events) return [] as string[];
    return Array.from(
      new Set(events.map((e) => e.operation_type ?? "UNKNOWN")),
    ).sort();
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return null;
    return events.filter((e) => {
      if (
        operationFilter !== "ALL" &&
        (e.operation_type ?? "UNKNOWN") !== operationFilter
      ) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          e.proposal_id,
          e.source_entity,
          e.target_entity,
          e.skill_used,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, operationFilter, search]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lineage" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  const loading = events === null;
  const total = events?.length ?? 0;
  const perProposal = useMemo(() => {
    const m = new Map<string, number>();
    (events ?? []).forEach((e) => {
      const k = e.proposal_id ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m.size;
  }, [events]);

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Lineage"
        description="Immutable ledger of every transformation performed by the pipeline. Each event records the source, target, operation, and skill that produced it."
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Events
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : total}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Total in lineage ledger
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Proposals
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : perProposal}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Distinct proposal IDs
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Operation types
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : operationTypes.length}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">Distinct operations</div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Latest
          </div>
          <div className="mt-2 text-sm font-medium">
            {loading || !events || events.length === 0
              ? "—"
              : formatRelative(events[0].executed_at)}
          </div>
          {events && events.length > 0 && events[0].executed_at ? (
            <div className="mt-1 text-2xs text-fg-muted font-mono">
              {formatDate(events[0].executed_at)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          className="input w-80"
          placeholder="Search proposal ID, source, target, skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={operationFilter}
          onChange={(e) => setOperationFilter(e.target.value)}
        >
          <option value="ALL">All operations</option>
          {operationTypes.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div className="ml-auto text-2xs text-fg-muted font-mono">
          {filtered?.length ?? "—"} of {total}
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="panel-body space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-bg-subtle anim-fade" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <table className="table-base">
            <thead>
              <tr>
                <th>Executed</th>
                <th>Proposal</th>
                <th>Source</th>
                <th>Operation</th>
                <th>Target</th>
                <th>Skill</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="text-2xs text-fg-muted whitespace-nowrap">
                    <div>{formatRelative(e.executed_at)}</div>
                    <div className="text-fg-subtle font-mono">
                      {formatDate(e.executed_at)}
                    </div>
                  </td>
                  <td className="font-mono text-2xs">
                    {e.proposal_id ?? (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="font-mono text-xs">
                    {e.source_entity ?? (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td>
                    <OperationBadge op={e.operation_type} />
                  </td>
                  <td className="font-mono text-xs">
                    {e.target_entity ?? (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="font-mono text-2xs text-fg-muted">
                    {e.skill_used ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="panel-body text-sm text-fg-muted">
            No lineage events match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
