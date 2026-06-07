"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  getGraphImpact,
  getGraphLineage,
  listGraphEdges,
  listGraphNodes,
} from "@/lib/api";
import type {
  GraphEdgeResponse,
  GraphNodeResponse,
  ImpactAnalysisResponse,
  LineageGraphResponse,
} from "@/lib/types";
import { PageHeader, SectionHeader } from "@/components/page-header";

const NODE_TYPE_COLORS: Record<string, string> = {
  TABLE: "text-info bg-info-bg border-info-border",
  SKILL: "text-success bg-success-bg border-success-border",
  KPI: "text-warning bg-warning-bg border-warning-border",
  PROJECT: "text-fg-muted bg-bg-subtle border-border",
  PII_COLUMN: "text-danger bg-danger-bg border-danger-border",
  SOURCE: "text-fg-muted bg-bg-subtle border-border",
};

const RELATION_COLORS: Record<string, string> = {
  BELONGS_TO: "text-fg-muted bg-bg-subtle border-border",
  DEPENDS_ON: "text-danger bg-danger-bg border-danger-border",
  USES_SKILL: "text-success bg-success-bg border-success-border",
  FOREIGN_KEY_OF: "text-info bg-info-bg border-info-border",
  AFFECTS_KPI: "text-warning bg-warning-bg border-warning-border",
  GENERATED_BY: "text-fg-muted bg-bg-subtle border-border",
  TRANSFORMS_INTO: "text-info bg-info-bg border-info-border",
  MUTATES_VIA: "text-fg-muted bg-bg-subtle border-border",
  PROTECTED_BY: "text-success bg-success-bg border-success-border",
};

function NodeTypeBadge({ type }: { type: string | null | undefined }) {
  const t = type ?? "UNKNOWN";
  const color =
    NODE_TYPE_COLORS[t] ?? "text-fg-muted bg-bg-subtle border-border";
  return (
    <span className={clsx("badge uppercase tracking-wider font-mono", color)}>
      {t.replace(/_/g, " ")}
    </span>
  );
}

function RelationBadge({ relation }: { relation: string | null | undefined }) {
  const r = relation ?? "UNKNOWN";
  const color =
    RELATION_COLORS[r] ?? "text-fg-muted bg-bg-subtle border-border";
  return (
    <span className={clsx("badge uppercase tracking-wider font-mono", color)}>
      {r.replace(/_/g, " ")}
    </span>
  );
}

type BrowserTab = "nodes" | "edges";

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNodeResponse[] | null>(null);
  const [edges, setEdges] = useState<GraphEdgeResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BrowserTab>("nodes");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("ALL");
  const [relationFilter, setRelationFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listGraphNodes(), listGraphEdges()])
      .then(([n, e]) => {
        if (cancelled) return;
        setNodes(n);
        setEdges(e);
      })
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const nodeTypes = useMemo(() => {
    if (!nodes) return [] as string[];
    return Array.from(new Set(nodes.map((n) => n.node_type ?? "UNKNOWN"))).sort();
  }, [nodes]);

  const relationTypes = useMemo(() => {
    if (!edges) return [] as string[];
    return Array.from(
      new Set(edges.map((e) => e.relation_type ?? "UNKNOWN")),
    ).sort();
  }, [edges]);

  const filteredNodes = useMemo(() => {
    if (!nodes) return null;
    if (nodeTypeFilter === "ALL") return nodes;
    return nodes.filter((n) => (n.node_type ?? "UNKNOWN") === nodeTypeFilter);
  }, [nodes, nodeTypeFilter]);

  const filteredEdges = useMemo(() => {
    if (!edges) return null;
    if (relationFilter === "ALL") return edges;
    return edges.filter((e) => (e.relation_type ?? "UNKNOWN") === relationFilter);
  }, [edges, relationFilter]);

  const nodeById = useMemo(() => {
    const m = new Map<number, GraphNodeResponse>();
    (nodes ?? []).forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Knowledge graph" />
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  const loading = nodes === null || edges === null;
  const nodeCount = nodes?.length ?? 0;
  const edgeCount = edges?.length ?? 0;
  const dependsOnCount =
    edges?.filter((e) => e.relation_type === "DEPENDS_ON").length ?? 0;
  const usesSkillCount =
    edges?.filter((e) => e.relation_type === "USES_SKILL").length ?? 0;

  return (
    <div className="space-y-6 anim-fade">
      <PageHeader
        title="Knowledge graph"
        description="The relationship graph connecting tables, skills, KPIs, and PII columns. Use it to trace lineage and assess change impact."
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Nodes
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : nodeCount}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            {loading ? "—" : nodeTypes.length} types
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Edges
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : edgeCount}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            {loading ? "—" : relationTypes.length} relations
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Depends-on
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : dependsOnCount}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Table dependencies
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Uses-skill
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "—" : usesSkillCount}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Skill assignments
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="border-b border-border-subtle px-1 py-1 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {(
              [
                { key: "nodes", label: "Nodes" },
                { key: "edges", label: "Edges" },
              ] as { key: BrowserTab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  "px-3 h-8 text-sm rounded-md transition-colors",
                  tab === t.key
                    ? "bg-bg-subtle text-fg font-medium"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="px-3 flex items-center gap-2">
            {tab === "nodes" ? (
              <select
                className="input h-7 w-40 text-2xs"
                value={nodeTypeFilter}
                onChange={(e) => setNodeTypeFilter(e.target.value)}
              >
                <option value="ALL">All types</option>
                {nodeTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="input h-7 w-40 text-2xs"
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
              >
                <option value="ALL">All relations</option>
                {relationTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {tab === "nodes" ? (
          loading ? (
            <div className="panel-body space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-bg-subtle anim-fade" />
              ))}
            </div>
          ) : filteredNodes && filteredNodes.length > 0 ? (
            <table className="table-base">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Name</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.map((n) => {
                  const meta = n.metadata
                    ? Object.keys(n.metadata).length
                    : 0;
                  return (
                    <tr key={n.id}>
                      <td className="font-mono text-2xs text-fg-muted">
                        #{n.id}
                      </td>
                      <td>
                        <NodeTypeBadge type={n.node_type} />
                      </td>
                      <td className="font-mono text-xs">
                        {n.entity_id ?? "—"}
                      </td>
                      <td className="text-sm">{n.entity_name ?? "—"}</td>
                      <td className="text-2xs text-fg-muted font-mono">
                        {meta === 0
                          ? "—"
                          : `${meta} field${meta === 1 ? "" : "s"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="panel-body text-sm text-fg-muted">
              No nodes match this filter.
            </div>
          )
        ) : loading ? (
          <div className="panel-body space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-bg-subtle anim-fade" />
            ))}
          </div>
        ) : filteredEdges && filteredEdges.length > 0 ? (
          <table className="table-base">
            <thead>
              <tr>
                <th>Source</th>
                <th>Relation</th>
                <th>Target</th>
                <th className="text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filteredEdges.map((e) => {
                const source = nodeById.get(e.source_node_id);
                const target = nodeById.get(e.target_node_id);
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="font-mono text-xs">
                        {source?.entity_id ?? `#${e.source_node_id}`}
                      </div>
                      {source?.entity_name ? (
                        <div className="text-2xs text-fg-muted mt-0.5">
                          {source.entity_name}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <RelationBadge relation={e.relation_type} />
                    </td>
                    <td>
                      <div className="font-mono text-xs">
                        {target?.entity_id ?? `#${e.target_node_id}`}
                      </div>
                      {target?.entity_name ? (
                        <div className="text-2xs text-fg-muted mt-0.5">
                          {target.entity_name}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-fg-muted">
                      {e.confidence_score != null
                        ? e.confidence_score.toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="panel-body text-sm text-fg-muted">
            No edges match this filter.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <LineageExplorer nodeTypes={nodeTypes} />
        <ImpactAnalyzer nodeTypes={nodeTypes} />
      </div>
    </div>
  );
}

function LineageExplorer({ nodeTypes }: { nodeTypes: string[] }) {
  const [entity, setEntity] = useState("");
  const [maxDepth, setMaxDepth] = useState(4);
  const [data, setData] = useState<LineageGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  async function run() {
    if (!entity.trim()) return;
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const res = await getGraphLineage(entity.trim(), maxDepth);
      setData(res);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3 className="text-sm font-semibold">Lineage explorer</h3>
          <p className="text-2xs text-fg-muted mt-0.5">
            Forward BFS — what does this entity touch?
          </p>
        </div>
      </div>
      <div className="panel-body space-y-4">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <label className="label">Entity</label>
            <input
              type="text"
              className="input font-mono"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              placeholder="e.g. orders_clean"
              list="graph-entities"
            />
            <datalist id="graph-entities">
              {nodeTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="col-span-3">
            <label className="label">Max depth</label>
            <select
              className="input"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-end">
            <button
              onClick={run}
              disabled={!entity.trim() || loading}
              className="btn-primary w-full"
            >
              {loading ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {hasRun && !loading && data ? (
          <TraversalResults data={data} />
        ) : hasRun && loading ? (
          <div className="h-24 rounded bg-bg-subtle anim-fade" />
        ) : (
          <div className="text-2xs text-fg-muted">
            Enter an entity name and click Run. The traversal returns every
            node reachable within the depth limit.
          </div>
        )}
      </div>
    </div>
  );
}

function ImpactAnalyzer({ nodeTypes }: { nodeTypes: string[] }) {
  const [entity, setEntity] = useState("");
  const [maxDepth, setMaxDepth] = useState(4);
  const [data, setData] = useState<ImpactAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  async function run() {
    if (!entity.trim()) return;
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const res = await getGraphImpact(entity.trim());
      setData(res);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3 className="text-sm font-semibold">Impact analyzer</h3>
          <p className="text-2xs text-fg-muted mt-0.5">
            Reverse BFS — what depends on this entity?
          </p>
        </div>
      </div>
      <div className="panel-body space-y-4">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <label className="label">Entity</label>
            <input
              type="text"
              className="input font-mono"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              placeholder="e.g. customers"
              list="graph-entities-impact"
            />
            <datalist id="graph-entities-impact">
              {nodeTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="col-span-3">
            <label className="label">Max depth</label>
            <select
              className="input"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-end">
            <button
              onClick={run}
              disabled={!entity.trim() || loading}
              className="btn-primary w-full"
            >
              {loading ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {hasRun && !loading && data ? <ImpactResults data={data} /> : hasRun && loading ? (
          <div className="h-24 rounded bg-bg-subtle anim-fade" />
        ) : (
          <div className="text-2xs text-fg-muted">
            Enter an entity and click Run. The analysis returns every node that
            transitively depends on it, with the shortest path.
          </div>
        )}
      </div>
    </div>
  );
}

function TraversalResults({ data }: { data: LineageGraphResponse }) {
  if (data.nodes.length === 0) {
    return (
      <div className="text-2xs text-fg-muted">
        No nodes reachable from this entity within the depth limit.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-2xs">
        <div className="text-fg-muted">
          {data.nodes.length} node{data.nodes.length === 1 ? "" : "s"} ·{" "}
          {data.edges.length} edge{data.edges.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted mb-1.5">
            Nodes
          </div>
          <ul className="space-y-1 max-h-64 overflow-auto pr-1">
            {data.nodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border-subtle bg-bg-inset"
              >
                <div className="min-w-0">
                  <div className="font-mono truncate">
                    {n.entity_id ?? `#${n.id}`}
                  </div>
                  {n.entity_name ? (
                    <div className="text-2xs text-fg-muted truncate">
                      {n.entity_name}
                    </div>
                  ) : null}
                </div>
                <NodeTypeBadge type={n.node_type} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted mb-1.5">
            Edges
          </div>
          {data.edges.length === 0 ? (
            <div className="text-2xs text-fg-muted">No edges.</div>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-auto pr-1">
              {data.edges.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 text-2xs px-2 py-1.5 rounded border border-border-subtle bg-bg-inset"
                >
                  <span className="font-mono truncate">
                    {e.source_node_id}
                  </span>
                  <RelationBadge relation={e.relation_type} />
                  <span className="font-mono truncate">
                    {e.target_node_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactResults({ data }: { data: ImpactAnalysisResponse }) {
  if (data.impacted_nodes.length === 0) {
    return (
      <div className="text-2xs text-fg-muted">
        Nothing depends on this entity within the depth limit.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-2xs">
        <div className="text-fg-muted">
          {data.total_impacted} impacted · starting from{" "}
          {data.start_nodes.length} node
          {data.start_nodes.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="space-y-1 max-h-64 overflow-auto pr-1">
        {data.impacted_nodes.map((i, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded border border-border-subtle bg-bg-inset"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono truncate">
                  {i.node.entity_id ?? `#${i.node.id}`}
                </span>
                <NodeTypeBadge type={i.node.node_type} />
                <RelationBadge relation={i.relation_type} />
              </div>
              {i.path.length > 0 ? (
                <div className="text-2xs text-fg-muted font-mono mt-0.5 truncate">
                  path: {i.path.join(" → ")}
                </div>
              ) : null}
            </div>
            <span
              className={clsx(
                "text-2xs font-mono tabular-nums",
                i.depth === 1 ? "text-danger" : "text-fg-muted",
              )}
            >
              depth {i.depth}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
