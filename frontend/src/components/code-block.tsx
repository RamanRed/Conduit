"use client";

import clsx from "clsx";

export function CodeBlock({
  code,
  language = "python",
  maxHeight,
  className,
}: {
  code: string;
  language?: string;
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative rounded-md border border-border-subtle bg-bg-inset overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-bg-subtle">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-border-strong" />
          <span className="w-2 h-2 rounded-full bg-border-strong" />
          <span className="w-2 h-2 rounded-full bg-border-strong" />
        </div>
        <span className="text-2xs font-mono uppercase tracking-wider text-fg-muted">
          {language}
        </span>
      </div>
      <pre
        className={clsx(
          "text-xs font-mono leading-relaxed text-fg overflow-auto p-4",
          maxHeight ?? "max-h-96",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
