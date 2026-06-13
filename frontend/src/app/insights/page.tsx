"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { listInsights, getInsightsSummary } from "@/lib/api";
import type { InsightItem, InsightCategory, InsightSeverity } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightItem[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    by_category: Record<string, number>;
    by_severity: Record<string, number>;
    recent_critical: InsightItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    Promise.all([
      listInsights({ limit: 100 }),
      getInsightsSummary()
    ])
      .then(([insList, sumData]) => {
        if (cancelled) return;
        setInsights(insList);
        setSummary(sumData);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err.message ?? err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredInsights = useMemo(() => {
    if (!insights) return [];
    return insights.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (severityFilter !== "ALL" && item.severity !== severityFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.proposal_id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [insights, categoryFilter, severityFilter, searchQuery]);

  // Derived stats
  const stats = useMemo(() => {
    if (!summary || !insights) return { criticalCount: 0, warningCount: 0, infoCount: 0, qualityScore: 100, topCategory: "—" };

    const critical = summary.by_severity["CRITICAL"] ?? 0;
    const warning = summary.by_severity["WARNING"] ?? 0;
    const info = summary.by_severity["INFO"] ?? 0;

    // Calculate a data quality score (base 100, deduct for critical and warning findings)
    const score = Math.max(30, 100 - (critical * 12) - (warning * 4));

    // Find top category
    let maxCount = -1;
    let topCat = "—";
    Object.entries(summary.by_category).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCat = cat;
      }
    });

    return {
      criticalCount: critical,
      warningCount: warning,
      infoCount: info,
      qualityScore: Math.round(score),
      topCategory: topCat.replace(/_/g, " "),
    };
  }, [summary, insights]);

  const categoryTags: Record<InsightCategory, { label: string; bg: string }> = {
    CONCENTRATION: { label: "Concentration", bg: "text-purple-600 bg-purple-50 border-purple-100" },
    ANOMALY: { label: "Anomaly", bg: "text-amber-600 bg-amber-50 border-amber-100" },
    DATA_QUALITY: { label: "Data Quality", bg: "text-rose-600 bg-rose-50 border-rose-100" },
    TREND: { label: "Trend", bg: "text-blue-600 bg-blue-50 border-blue-100" },
    PATTERN: { label: "Pattern", bg: "text-teal-600 bg-teal-50 border-teal-100" },
  };

  return (
    <div className="space-y-8 anim-fade">
      <PageHeader
        title="Data Insights"
        description="Statistical discoveries, anomalous trends, concentration spikes, and data quality patterns automatically generated after pipeline executions."
      />

      {error && (
        <div className="card border-danger-border bg-danger-bg p-4 text-sm text-danger">
          Failed to load insights: {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Total Insights
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-fg tabular-nums">
            {loading ? "—" : summary?.total ?? 0}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Across all active tables
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Critical Alerts
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-danger tabular-nums">
            {loading ? "—" : stats.criticalCount}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Require immediate attention
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Top Pattern Area
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-fg truncate">
            {loading ? "—" : stats.topCategory}
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Most frequent insight type
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
            Data Quality Score
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={clsx(
              "text-3xl font-bold tracking-tight tabular-nums",
              stats.qualityScore >= 85 ? "text-success" : stats.qualityScore >= 60 ? "text-warning" : "text-danger"
            )}>
              {loading ? "—" : `${stats.qualityScore}%`}
            </span>
          </div>
          <div className="mt-1 text-2xs text-fg-muted">
            Weighted batch health score
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Category Breakdown Panel */}
        <div className="col-span-12 md:col-span-3 space-y-6">
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold">Distribution</h3>
            </div>
            <div className="panel-body space-y-4">
              {loading || !summary ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-6 rounded bg-bg-subtle anim-fade" />
                  ))}
                </div>
              ) : Object.keys(summary.by_category).length === 0 ? (
                <div className="text-xs text-fg-muted">No category data yet.</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summary.by_category).map(([cat, count]) => {
                    const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-medium text-fg-muted">{cat.replace(/_/g, " ")}</span>
                          <span className="font-mono text-fg">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full",
                              cat === "CONCENTRATION" && "bg-purple-500",
                              cat === "ANOMALY" && "bg-amber-500",
                              cat === "DATA_QUALITY" && "bg-rose-500",
                              cat === "TREND" && "bg-blue-500",
                              cat === "PATTERN" && "bg-teal-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="card p-4 bg-bg-inset border-border-subtle space-y-2">
            <h4 className="text-2xs font-bold uppercase tracking-wider text-fg-muted">
              About Insight Engine
            </h4>
            <p className="text-2xs text-fg-muted leading-relaxed">
              Every time a transformation executes successfully, Conduit profiles the loaded rows. 
              The engine automatically detects mathematical anomalies, regional concentrations, and 
              temporal spikes, packaging the stats for the AI to summarize into business terms.
            </p>
          </div>
        </div>

        {/* Insights list feed */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {/* Filters Bar */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-fg-muted block mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-2 bg-bg border border-border rounded text-xs focus:outline-none focus:border-fg"
                >
                  <option value="ALL">All Categories</option>
                  <option value="CONCENTRATION">Concentration</option>
                  <option value="ANOMALY">Anomaly</option>
                  <option value="DATA_QUALITY">Data Quality</option>
                  <option value="TREND">Trend</option>
                  <option value="PATTERN">Pattern</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-fg-muted block mb-1">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="h-8 px-2 bg-bg border border-border rounded text-xs focus:outline-none focus:border-fg"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <label className="text-[10px] uppercase font-bold text-fg-muted block mb-1">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, description, proposal..."
                className="w-full h-8 px-3 text-xs bg-bg border border-border rounded placeholder:text-fg-subtle focus:outline-none focus:border-fg"
              />
            </div>
          </div>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-bg-subtle anim-fade" />
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="card p-8 text-center text-sm text-fg-muted bg-white">
              No insights match your selected filters. Execute more runs or adjust filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInsights.map((item) => {
                const tag = categoryTags[item.category] || { label: item.category, bg: "text-fg bg-bg border-border" };
                return (
                  <div
                    key={item.id}
                    className="card p-5 bg-white hover:border-fg-subtle transition-all duration-150 space-y-3 flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "badge text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5",
                          item.severity === "CRITICAL" && "text-danger bg-danger-bg border-danger-border",
                          item.severity === "WARNING" && "text-warning bg-warning-bg border-warning-border",
                          item.severity === "INFO" && "text-info bg-info-bg border-info-border",
                        )}>
                          {item.severity}
                        </span>
                        <span className={clsx("badge text-[10px] font-mono tracking-wider px-1.5 py-0.5", tag.bg)}>
                          {tag.label}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-fg tracking-tight leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-sm text-fg-muted leading-relaxed">
                        {item.description}
                      </p>
                      
                      {item.evidence && Object.keys(item.evidence).length > 0 && (
                        <details className="text-2xs font-mono pt-1 text-fg-subtle cursor-pointer select-none">
                          <summary className="hover:text-fg font-sans font-medium mb-1">View Evidence Statistics</summary>
                          <pre className="p-3 bg-bg-subtle border border-border-subtle rounded text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(item.evidence, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    <div className="md:text-right shrink-0 flex flex-col items-start md:items-end justify-between h-full text-xs font-mono text-fg-subtle">
                      <Link
                        href={`/proposals/${item.proposal_id}`}
                        className="hover:underline hover:text-fg font-semibold"
                      >
                        Proposal: {item.proposal_id.slice(0, 8)}…
                      </Link>
                      {item.created_at && (
                        <div className="text-3xs text-fg-subtle mt-1">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
