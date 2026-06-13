"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { getSkill } from "@/lib/api";
import type { SkillDetailResponse, SkillStatus } from "@/lib/types";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { formatDate, formatRelative } from "@/lib/format";

const CATEGORY_COLORS: Record<string, string> = {
  SECURITY: "text-danger bg-danger-bg border-danger-border",
  SCHEMA_EVOLUTION: "text-warning bg-warning-bg border-warning-border",
  DATA_CLEANING: "text-info bg-info-bg border-info-border",
  DATETIME_STANDARDIZATION:
    "text-fg-muted bg-bg-subtle border-border",
  VALIDATION: "text-success bg-success-bg border-success-border",
};

const STATUS_COLORS: Record<SkillStatus, string> = {
  ACTIVE: "text-success bg-success-bg border-success-border",
  DRAFT: "text-warning bg-warning-bg border-warning-border",
  DEPRECATED: "text-fg-muted bg-bg-subtle border-border",
};

function CategoryBadge({ category }: { category: string }) {
  const color =
    CATEGORY_COLORS[category] ??
    "text-fg-muted bg-bg-subtle border-border";
  return (
    <span className={clsx("badge uppercase tracking-wider font-mono", color)}>
      {category.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span
      className={clsx("badge uppercase tracking-wider", STATUS_COLORS[status])}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          status === "ACTIVE" && "bg-success",
          status === "DRAFT" && "bg-warning",
          status === "DEPRECATED" && "bg-fg-subtle",
        )}
      />
      {status}
    </span>
  );
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [skill, setSkill] = useState<SkillDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const skillId = parseInt(id, 10);
    if (Number.isNaN(skillId)) {
      setError(`Invalid skill id: ${id}`);
      return;
    }
    setSkill(null);
    setError(null);
    getSkill(skillId)
      .then(setSkill)
      .catch((e) => setError(String(e.message ?? e)));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Skill" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loading skill…" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <div className="h-40 rounded-lg bg-bg-subtle anim-fade" />
            <div className="h-64 rounded-lg bg-bg-subtle anim-fade" />
          </div>
          <div className="col-span-4">
            <div className="h-64 rounded-lg bg-bg-subtle anim-fade" />
          </div>
        </div>
      </div>
    );
  }

  const scripts = skill.scripts ?? [];
  const examples = skill.examples ?? [];
  const issueRefs = skill.issue_references ?? [];

  return (
    <div className="space-y-6 anim-fade">
      <div className="space-y-3">
        <Link
          href="/skills"
          className="text-2xs text-fg-muted hover:text-fg inline-flex items-center gap-1"
        >
          ← Skill registry
        </Link>
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-border-subtle">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight font-mono">
                {skill.skill_name}
              </h1>
              <span className="text-2xs text-fg-muted font-mono">
                v{skill.version}
              </span>
              <CategoryBadge category={skill.category} />
              <StatusBadge status={skill.status} />
            </div>
            <p className="mt-2 text-sm text-fg-muted max-w-3xl leading-relaxed">
              {skill.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          {skill.use_cases || skill.constraints ? (
            <div className="grid grid-cols-2 gap-4">
              {skill.use_cases ? (
                <div className="card p-4">
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Use cases
                  </div>
                  <p className="mt-2 text-sm text-fg leading-relaxed whitespace-pre-line">
                    {skill.use_cases}
                  </p>
                </div>
              ) : null}
              {skill.constraints ? (
                <div className="card p-4">
                  <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                    Constraints
                  </div>
                  <p className="mt-2 text-sm text-fg leading-relaxed whitespace-pre-line">
                    {skill.constraints}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="text-sm font-semibold">Scripts</h3>
                <p className="text-2xs text-fg-muted mt-0.5">
                  Validated script references executed by the runtime
                </p>
              </div>
              <span className="text-2xs text-fg-muted font-mono">
                {scripts.length} {scripts.length === 1 ? "script" : "scripts"}
              </span>
            </div>
            {scripts.length > 0 ? (
              <div className="space-y-4">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Hash</th>
                      <th>Validated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scripts.map((s, i) => {
                      const path = (s.script_path as string | null) ?? "—";
                      const hash = (s.script_hash as string | null) ?? null;
                      const validated = Boolean(s.is_validated);
                      return (
                        <tr key={i}>
                          <td className="font-mono text-xs truncate max-w-md">
                            {path}
                          </td>
                          <td className="font-mono text-2xs text-fg-muted">
                            {shortHash(hash)}
                          </td>
                          <td>
                            <span
                              className={clsx(
                                "badge uppercase tracking-wider",
                                validated
                                  ? "text-success bg-success-bg border-success-border"
                                  : "text-warning bg-warning-bg border-warning-border",
                              )}
                            >
                              <span
                                className={clsx(
                                  "w-1.5 h-1.5 rounded-full",
                                  validated ? "bg-success" : "bg-warning",
                                )}
                              />
                              {validated ? "Yes" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {scripts.map((s, i) =>
                  s.code ? (
                    <div key={i} className="p-4 border-t border-border-subtle bg-bg-subtle/30 space-y-2 anim-in">
                      <div className="flex items-center justify-between">
                        <div className="text-2xs font-mono text-fg-muted">
                          Code for {s.script_path as string}
                        </div>
                        <CopyButton value={s.code as string} />
                      </div>
                      <CodeBlock
                        code={s.code as string}
                        language="python"
                        maxHeight="max-h-96"
                      />
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <div className="panel-body text-sm text-fg-muted">
                No scripts attached yet.
              </div>
            )}

          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="text-sm font-semibold">Examples</h3>
                <p className="text-2xs text-fg-muted mt-0.5">
                  Representative input → output pairs
                </p>
              </div>
              <span className="text-2xs text-fg-muted font-mono">
                {examples.length} {examples.length === 1 ? "example" : "examples"}
              </span>
            </div>
            {examples.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {examples.map((ex, i) => {
                  const inputStr =
                    ex.input != null ? JSON.stringify(ex.input, null, 2) : "";
                  const outputStr =
                    ex.output != null ? JSON.stringify(ex.output, null, 2) : "";
                  return (
                    <div key={i} className="p-4 space-y-2">
                      <div className="text-2xs font-mono text-fg-muted">
                        Example {i + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                              Input
                            </div>
                            {inputStr ? (
                              <CopyButton value={inputStr} />
                            ) : null}
                          </div>
                          <CodeBlock
                            code={inputStr || "—"}
                            language="json"
                            maxHeight="max-h-48"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
                              Output
                            </div>
                            {outputStr ? (
                              <CopyButton value={outputStr} />
                            ) : null}
                          </div>
                          <CodeBlock
                            code={outputStr || "—"}
                            language="json"
                            maxHeight="max-h-48"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel-body text-sm text-fg-muted">
                No examples registered.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="text-sm font-semibold">Historical issues</h3>
                <p className="text-2xs text-fg-muted mt-0.5">
                  Past incidents referenced when this skill is selected
                </p>
              </div>
              <span className="text-2xs text-fg-muted font-mono">
                {issueRefs.length} {issueRefs.length === 1 ? "issue" : "issues"}
              </span>
            </div>
            {issueRefs.length > 0 ? (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Resolution notes</th>
                  </tr>
                </thead>
                <tbody>
                  {issueRefs.map((r, i) => {
                    const ref = (r.reference as string | null) ?? "—";
                    const notes = (r.notes as string | null) ?? "";
                    return (
                      <tr key={i}>
                        <td className="font-mono text-xs whitespace-nowrap">
                          {ref}
                        </td>
                        <td className="text-sm text-fg-muted leading-relaxed">
                          {notes || (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="panel-body text-sm text-fg-muted">
                No historical issues linked.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="card p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Metadata</div>
              <p className="text-2xs text-fg-muted mt-0.5">
                Skill registration details
              </p>
            </div>
            <div className="divider" />
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-2xs text-fg-muted">Skill ID</dt>
                <dd className="font-mono text-xs mt-0.5">#{skill.id}</dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Version</dt>
                <dd className="font-mono text-xs mt-0.5">v{skill.version}</dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Category</dt>
                <dd className="mt-0.5">
                  <CategoryBadge category={skill.category} />
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Status</dt>
                <dd className="mt-0.5">
                  <StatusBadge status={skill.status} />
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Owner</dt>
                <dd className="text-xs mt-0.5 font-mono">
                  {skill.owner ?? (
                    <span className="text-fg-subtle">Unassigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-muted">Created</dt>
                <dd className="text-xs mt-0.5">
                  <div>{formatDate(skill.created_at)}</div>
                  {skill.created_at ? (
                    <div className="text-fg-muted text-2xs font-mono">
                      {formatRelative(skill.created_at)}
                    </div>
                  ) : null}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Composition</div>
              <p className="text-2xs text-fg-muted mt-0.5">
                Resources attached to this skill
              </p>
            </div>
            <div className="divider" />
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Scripts</dt>
                <dd className="font-mono tabular-nums">{scripts.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Examples</dt>
                <dd className="font-mono tabular-nums">{examples.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Issue references</dt>
                <dd className="font-mono tabular-nums">{issueRefs.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
