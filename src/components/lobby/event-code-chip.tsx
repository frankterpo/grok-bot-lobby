"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lobbyFetch } from "@/lib/client";

type EventCodeChipProps = {
  code: string;
  eventId: string;
  joinUrl: string;
};

export function EventCodeChip({ code, eventId, joinUrl }: EventCodeChipProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(kind: "code" | "link"): Promise<void> {
    await navigator.clipboard.writeText(kind === "code" ? code : joinUrl);
    setCopied(kind);
    await lobbyFetch("/api/events/share", {
      method: "POST",
      body: JSON.stringify({ eventId }),
    });
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        type="button"
        onClick={() => void copy("code")}
        className="micro flex items-center gap-1 rounded-md border border-[#262626] bg-[#111] px-1.5 py-0.5 text-white/50 hover:text-[#f59e0b]"
      >
        {copied === "code" ? <Check className="size-3" strokeWidth={1.5} /> : <Copy className="size-3" strokeWidth={1.5} />}
        {code}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-6 text-white/40 hover:text-[#f59e0b]"
        onClick={() => void copy("link")}
        aria-label="Copy shareable join link"
      >
        {copied === "link" ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />}
      </Button>
    </div>
  );
}
