"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export function CopyBlock({
  text,
  multiline = false,
  className,
}: {
  text: string;
  multiline?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-md border border-[#262626] bg-[#0d0d0d] px-2 py-1.5",
        multiline ? "flex-col sm:flex-row sm:items-start" : "items-center",
        className,
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 font-mono text-[10px] text-white/55",
          multiline ? "max-h-96 overflow-auto whitespace-pre-wrap leading-relaxed" : "truncate",
        )}
      >
        {text}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 text-white/35 hover:text-white/70"
        aria-label="Copy"
      >
        {copied ? <Check className="size-3" strokeWidth={1.5} /> : <Copy className="size-3" strokeWidth={1.5} />}
      </button>
    </div>
  );
}
