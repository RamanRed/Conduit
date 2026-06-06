"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listQuarantine } from "@/lib/api";
import type { QuarantineEntry } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { CodeBlock } from "@/components/code-block";
import { formatRelative } from "@/lib/format";

export default function QuarantinePage() {
  const [entries, setEntries] = useState<QuarantineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QuarantineEntry | null>(null);

  useEffect(() => {
    listQuarantine()
      .then((data) => {
        setEntries(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Quarantine"
        description="Rows that failed validation during execution. Each entry preserves the raw row and the reason it was rejected, so you can fix the source data and rerun."
      />

      {error ? (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {entries === null ? (
        <div className="h-32 rounded-lg bg-bg-subtle anim-fade" />
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center text-sm text-fg-muted">
          No quarantined rows. Everything is flowing through cleanly.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold">Quarantined rows</h3>
              <span className="text-2xs text-fg-muted font-mono">
                {entries.length} total
              </span>
            </div>
            <ul className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
              {entries.map((q) => (
                <li key={q.id}>
                  <button
                    onClick={() => setSelected(q)}
                    className={
                      selected?.id === q.id
                        ? "w-full text-left px-4 py-3 bg-bg-subtle"
                        : "w-full text-left px-4 py-3 hover:bg-bg-subtle"
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-2xs text-fg-muted">
                        #{q.id} · {q.proposal_id.slice(0, 8)}…
                      </div>
                      <div className="text-2xs text-fg-muted">
                        {formatRelative(q.quarantined_at)}
                      </div>
                    </div>
                    <div className="mt-1 text-2xs text-danger font-mono truncate">
                      {q.failure_reason}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-7 space-y-4">
            {selected ? (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="text-sm font-semibold">Raw row</h3>
                    <Link
                      href={`/proposals/${selected.proposal_id}`}
                      className="text-2xs text-fg-muted hover:text-fg"
                    >
                      View proposal →
                    </Link>
                  </div>
                  <div className="p-4">
                    <CodeBlock
                      code={JSON.stringify(selected.raw_row, null, 2)}
                      language="json"
                      maxHeight="max-h-[40vh]"
                    />
                  </div>
                </div>

                <div className="card p-4 space-y-3">
                  <div className="text-sm font-semibold">Failure reason</div>
                  <div className="text-2xs text-danger font-mono whitespace-pre-wrap leading-relaxed">
                    {selected.failure_reason}
                  </div>
                </div>

                <div className="card p-4">
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Quarantined at
                  </div>
                  <div className="mt-1 text-2xs text-fg-muted font-mono">
                    {selected.quarantined_at}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
