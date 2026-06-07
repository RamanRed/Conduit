import clsx from "clsx";
import {
  executionColor,
  gatewayColor,
  severityColor,
} from "@/lib/format";
import type { GatewayStatus, Severity } from "@/lib/types";

export function GatewayBadge({ status }: { status: GatewayStatus | string | null | undefined }) {
  const c = gatewayColor(status) || {
    fg: "text-danger",
    bg: "bg-danger-bg",
    border: "border-danger-border",
    label: "Conflict",
  };
  return (
    <span
      className={clsx(
        "badge uppercase tracking-wider",
        c.fg,
        c.bg,
        c.border,
      )}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          status === "AUTO_LINK" && "bg-success",
          status === "SCHEMA_EVOLUTION" && "bg-warning",
          status === "CONFLICT" && "bg-danger",
        )}
      />
      {c.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity | string | null | undefined }) {
  const c = severityColor(severity) || { fg: "text-fg-muted", bg: "bg-bg-subtle", border: "border-border" };
  return (
    <span className={clsx("badge uppercase tracking-wider", c.fg, c.bg, c.border)}>
      {severity || "LOW"}
    </span>
  );
}

export function ExecutionBadge({ status }: { status: string | null | undefined }) {
  const c = executionColor(status || "FAILED") || { fg: "text-fg-muted", bg: "bg-bg-subtle", border: "border-border" };
  return (
    <span
      className={clsx("badge uppercase tracking-wider", c.fg, c.bg, c.border)}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          status === "SUCCESS" && "bg-success",
          (status === "FAILED" || status === "ROLLEDBACK") && "bg-danger",
          !["SUCCESS", "FAILED", "ROLLEDBACK"].includes(status || "") && "bg-fg-muted",
        )}
      />
      {status || "FAILED"}
    </span>
  );
}


export function StatusDot({ status }: { status: string }) {
  const color =
    status === "CONNECTED" || status === "SUCCESS"
      ? "bg-success"
      : status === "UNREACHABLE" || status === "FAILED" || status === "ROLLEDBACK"
      ? "bg-danger"
      : "bg-fg-muted";
  return <span className={clsx("w-1.5 h-1.5 rounded-full", color)} />;
}
