"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { getAuditEntry } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ExecutionBadge } from "@/components/badges";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { formatDate, formatRelative } from "@/lib/format";

type Section = "overview" | "script" | "prompt" | "response";

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");

  useEffect(() => {
    if (!id || isNaN(id)) return;
    getAuditEntry(id)
      .then(setEntry)
      .catch((e) => setError(String(e.message ?? e)));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit entry" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loading audit entry…" />
        <div className="h-32 rounded-lg bg-bg-subtle anim-fade" />
      </div>
    );
  }

  return (
    <div className="space-y-6 anim-fade">
      <div className="space-y-3">
        <Link
          href="/audit"
          className="text-2xs text-fg-muted hover:text-fg inline-flex items-center gap-1"
        >
          ← Audit
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                Audit #{entry.id}
              </h1>
              <ExecutionBadge status={entry.execution_status} />
            </div>
            <p className="mt-1 text-2xs text-fg-muted font-mono">
              {entry.filename} · {entry.skill_name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-4">
          <div className="border-b border-border-subtle px-1 py-1 flex items-center gap-0.5">
            {(
              [
                { key: "overview", label: "Overview" },
                { key: "script", label: "Transformation" },
                { key: "prompt", label: "AI prompt" },
                { key: "response", label: "AI response" },
              ] as { key: Section; label: string }[]
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={clsx(
                  "px-3 h-8 text-sm rounded-md transition-colors",
                  section === s.key
                    ? "bg-bg-subtle text-fg font-medium"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section === "overview" && (
            <div className="panel">
              <div className="panel-body space-y-4">
                <div>
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Transformation script reference
                  </div>
                  <p className="mt-1 text-2xs text-fg-muted">
                    The exact Python code that was executed against the
                    warehouse. Verifying this against your expectation is the
                    primary safety step.
                  </p>
                </div>
                <CodeBlock
                  code={entry.transformation_script_ref || "// (empty)"}
                  language="python"
                  maxHeight="max-h-[60vh]"
                />
              </div>
            </div>
          )}

          {section === "script" && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">Executed script</h3>
                <CopyButton value={entry.transformation_script_ref} />
              </div>
              <div className="p-4">
                <CodeBlock
                  code={entry.transformation_script_ref || "// (empty)"}
                  language="python"
                  maxHeight="max-h-[70vh]"
                />
              </div>
            </div>
          )}

          {section === "prompt" && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">Prompt sent to the LLM</h3>
                <CopyButton value={entry.llm_prompt_sent} />
              </div>
              <div className="p-4">
                <CodeBlock
                  code={entry.llm_prompt_sent || "(no prompt recorded)"}
                  language="text"
                  maxHeight="max-h-[70vh]"
                />
              </div>
            </div>
          )}

          {section === "response" && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold">Raw LLM response</h3>
                <CopyButton value={entry.llm_raw_response} />
              </div>
              <div className="p-4">
                <CodeBlock
                  code={entry.llm_raw_response || "(no response recorded)"}
                  language="json"
                  maxHeight="max-h-[70vh]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="col-span-4 space-y-4">
          <div className="card p-4 space-y-3">
            <div className="text-sm font-semibold">Metadata</div>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-2xs text-fg-muted">Audit ID</dt>
                <dd className="font-mono text-xs mt-0.5">#{entry.id}</dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Proposal ID</dt>
                <dd className="font-mono text-2xs mt-0.5 break-all">
                  {entry.proposal_id}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">File</dt>
                <dd className="font-mono text-2xs mt-0.5">
                  {entry.filename}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Skill</dt>
                <dd className="font-mono text-2xs mt-0.5">
                  {entry.skill_name}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Approver</dt>
                <dd className="font-mono text-2xs mt-0.5">
                  {entry.human_approver_id}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Executed</dt>
                <dd className="text-2xs mt-0.5">
                  {formatRelative(entry.executed_at)}
                </dd>
                <dd className="text-2xs text-fg-subtle">
                  {formatDate(entry.executed_at)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
