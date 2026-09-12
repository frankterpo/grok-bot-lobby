"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lobbyFetch } from "@/lib/client";
import { cn } from "@/lib/utils";

type ShareLinkProps = {
  url: string;
  eventId?: string;
  compact?: boolean;
};

export function ShareLink({ url, eventId, compact = false }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (eventId) {
      await lobbyFetch("/api/events/share", {
        method: "POST",
        body: JSON.stringify({ eventId }),
      });
    }
  }

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className={cn("flex items-center gap-1.5", compact ? "" : "rounded-lg border border-[#262626] bg-[#161616] p-2")}>
      {compact ? null : (
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/70">{url}</p>
      )}
      <Button
        type="button"
        variant={compact ? "ghost" : "default"}
        size={compact ? "icon-xs" : "sm"}
        onClick={() => void copy()}
        className={compact ? "size-6 text-white/50 hover:text-[#f59e0b]" : "bg-[#f59e0b] text-[#0d0d0d] hover:bg-[#f59e0b]/90"}
        aria-label="Copy join link"
      >
        {copied ? <Check strokeWidth={1.5} /> : <Link2 strokeWidth={1.5} />}
        {compact ? null : <span>{copied ? "Copied" : "Copy join link"}</span>}
      </Button>
    </div>
  );
}
