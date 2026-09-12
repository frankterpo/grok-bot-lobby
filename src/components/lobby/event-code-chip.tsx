"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { lobbyFetch } from "@/lib/client";

type EventCodeChipProps = {
  code: string;
  eventId: string;
  joinUrl: string;
};

export function EventCodeChip({ code, eventId, joinUrl }: EventCodeChipProps) {
  const [copied, setCopied] = useState(false);

  async function copyJoinLink(): Promise<void> {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    await lobbyFetch("/api/events/share", {
      method: "POST",
      body: JSON.stringify({ eventId }),
    });
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={() => void copyJoinLink()}
      title={joinUrl}
      aria-label={`Copy join link (${joinUrl})`}
      className="micro flex items-center gap-1 rounded-md border border-[#262626] bg-[#111] px-1.5 py-0.5 text-white/50 hover:text-white/80"
    >
      {copied ? <Check className="size-3" strokeWidth={1.5} /> : <Copy className="size-3" strokeWidth={1.5} />}
      <span className="font-mono text-white/70">{code}</span>
      <span className="text-white/35">{copied ? "· link copied" : "· copy join link"}</span>
    </button>
  );
}
