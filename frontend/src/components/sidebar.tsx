"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const PRIMARY = [
  { href: "/", label: "Overview" },
  { href: "/ingest", label: "Ingest" },
  { href: "/proposals", label: "Proposals" },
  { href: "/audit", label: "Audit" },
  { href: "/quarantine", label: "Quarantine" },
  { href: "/insights", label: "Insights" },
];

const EXTENSIONS = [
  { href: "/skills", label: "Skill registry" },
  { href: "/graph", label: "Knowledge graph" },
  { href: "/lineage", label: "Lineage" },
];

const INFRA = [{ href: "/sources", label: "Sources" }];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: { href: string; label: string }[];
  pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      {label ? (
        <div className="px-3 mt-3 mb-1 text-2xs font-medium uppercase tracking-wider text-fg-subtle">
          {label}
        </div>
      ) : null}
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-2 px-3 h-7 text-sm rounded-md transition-colors",
              active
                ? "bg-bg-subtle text-fg font-medium"
                : "text-fg-muted hover:text-fg hover:bg-bg-subtle",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border-subtle bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-fg flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Conduit</div>
          <div className="text-2xs text-fg-muted">data engineering</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <NavGroup items={PRIMARY} pathname={pathname} />
        <NavGroup label="Extensions" items={EXTENSIONS} pathname={pathname} />
        <NavGroup label="Infrastructure" items={INFRA} pathname={pathname} />
      </nav>

      <div className="border-t border-border-subtle p-3">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>API connected</span>
        </div>
        <div className="mt-1 text-2xs text-fg-subtle font-mono">
          localhost:8000
        </div>
      </div>
    </aside>
  );
}
