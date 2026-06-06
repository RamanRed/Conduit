import type { GatewayStatus, Severity } from "./types";

export function gatewayColor(g: GatewayStatus): {
  fg: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (g) {
    case "AUTO_LINK":
      return {
        fg: "text-success",
        bg: "bg-success-bg",
        border: "border-success-border",
        label: "Auto Link",
      };
    case "SCHEMA_EVOLUTION":
      return {
        fg: "text-warning",
        bg: "bg-warning-bg",
        border: "border-warning-border",
        label: "Schema Evolution",
      };
    case "CONFLICT":
      return {
        fg: "text-danger",
        bg: "bg-danger-bg",
        border: "border-danger-border",
        label: "Conflict",
      };
  }
}

export function severityColor(s: Severity): {
  fg: string;
  bg: string;
  border: string;
} {
  switch (s) {
    case "LOW":
      return { fg: "text-fg-muted", bg: "bg-bg-subtle", border: "border-border" };
    case "MEDIUM":
      return {
        fg: "text-warning",
        bg: "bg-warning-bg",
        border: "border-warning-border",
      };
    case "HIGH":
      return {
        fg: "text-danger",
        bg: "bg-danger-bg",
        border: "border-danger-border",
      };
  }
}

export function executionColor(s: string): {
  fg: string;
  bg: string;
  border: string;
} {
  switch (s) {
    case "SUCCESS":
      return {
        fg: "text-success",
        bg: "bg-success-bg",
        border: "border-success-border",
      };
    case "FAILED":
    case "ROLLEDBACK":
      return {
        fg: "text-danger",
        bg: "bg-danger-bg",
        border: "border-danger-border",
      };
    default:
      return { fg: "text-fg-muted", bg: "bg-bg-subtle", border: "border-border" };
  }
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(iso);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
