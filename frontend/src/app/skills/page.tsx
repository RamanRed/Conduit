"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { listSkills } from "@/lib/api";
import type { SkillResponse, SkillStatus } from "@/lib/types";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/format";

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
    <span
      className={clsx(
        "badge uppercase tracking-wider font-mono",
        color,
      )}
    >
      {category.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span
      className={clsx(
        "badge uppercase tracking-wider",
        STATUS_COLORS[status],
      )}
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

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const categories = useMemo(() => {
    if (!skills) return [] as string[];
    return Array.from(new Set(skills.map((s) => s.category))).sort();
  }, [skills]);

  const filtered = useMemo(() => {
    if (!skills) return null;
    return skills.filter((s) => {
      if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.skill_name.toLowerCase().includes(q) &&
          !s.description.toLowerCase().includes(q) &&
          !(s.use_cases ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [skills, categoryFilter, statusFilter, search]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Skill registry" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Skill registry"
        description="Catalog of reusable data transformation skills. Skills are injected into the LLM context so generated transformations follow organizational standards."
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setView("grid")}
              className={
                view === "grid" ? "btn-secondary h-8" : "btn-ghost h-8"
              }
            >
              Grid
            </button>
            <button
              onClick={() => setView("table")}
              className={
                view === "table" ? "btn-secondary h-8" : "btn-ghost h-8"
              }
            >
              Table
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          className="input w-64"
          placeholder="Search skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="input w-36"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="DEPRECATED">Deprecated</option>
        </select>
        <div className="ml-auto text-2xs text-fg-muted font-mono">
          {filtered?.length ?? "—"} of {skills?.length ?? "—"}
        </div>
      </div>

      {skills === null ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-bg-subtle anim-fade" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        view === "grid" ? (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/skills/${s.id}`}
                className="card p-4 hover:border-fg-subtle transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-medium truncate">
                      {s.skill_name}
                    </div>
                    <div className="text-2xs text-fg-muted font-mono mt-0.5">
                      v{s.version}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3">
                  <CategoryBadge category={s.category} />
                </div>
                <p className="mt-3 text-sm text-fg-muted line-clamp-3 leading-relaxed">
                  {s.description}
                </p>
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-2xs text-fg-muted">
                  <span className="truncate">{s.owner ?? "—"}</span>
                  <span>{formatRelative(s.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/skills/${s.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {s.skill_name}
                      </Link>
                    </td>
                    <td className="font-mono text-2xs text-fg-muted">
                      v{s.version}
                    </td>
                    <td>
                      <CategoryBadge category={s.category} />
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-fg-muted">{s.owner ?? "—"}</td>
                    <td className="text-2xs text-fg-muted">
                      {formatRelative(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="card p-8 text-center text-sm text-fg-muted">
          No skills match these filters.
        </div>
      )}
    </div>
  );
}
