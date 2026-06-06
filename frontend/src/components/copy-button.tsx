"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {}
      }}
      className={clsx(
        "btn-ghost h-6 px-2 text-2xs",
        copied && "text-success",
      )}
      type="button"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
