import clsx from "clsx";
import {
  executionColor,
  gatewayColor,
  severityColor,
} from "@/lib/format";
import type { GatewayStatus, Severity } from "@/lib/types";

export function GatewayBadge({ status }: { status: GatewayStatus }) {
  const c = gatewayColor(status);
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

export function SeverityBadge({ severity }: { severity: Severity }) {
  const c = severityColor(severity);
  return (
    <span className={clsx("badge uppercase tracking-wider", c.fg, c.bg, c.border)}>
      {severity}
    </span>
  );
}

export function ExecutionBadge({ status }: { status: string }) {
  const c = executionColor(status);
  return (
    <span
      className={clsx("badge uppercase tracking-wider", c.fg, c.bg, c.border)}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          status === "SUCCESS" && "bg-success",
          (status === "FAILED" || status === "ROLLEDBACK") && "bg-danger",
          !["SUCCESS", "FAILED", "ROLLEDBACK"].includes(status) && "bg-fg-muted",
        )}
      />
      {status}
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
