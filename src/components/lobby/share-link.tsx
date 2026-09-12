"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lobbyFetch } from "@/lib/client";
import { PERSISTENT_TUNNEL_DOC_PATH, resolveShareJoinUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

type ShareLinkProps = {
  url: string;
  eventId?: string;
  compact?: boolean;
};

export function ShareLink({ url, eventId, compact = false }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const resolved = useMemo(() => resolveShareJoinUrl(url), [url]);
  const shareUrl = resolved.url;

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(shareUrl);
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
    <div className={cn("space-y-2", compact ? "" : "")}>
      {!resolved.isRemoteShareable && !compact ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" strokeWidth={1.5} />
          <p className="text-[11px] leading-relaxed text-amber-100/90">
            <span className="font-medium text-amber-200">Not shareable remotely.</span> Set{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">LOBBY_PUBLIC_URL</code>{" "}
            and{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">
              NEXT_PUBLIC_LOBBY_PUBLIC_URL
            </code>{" "}
            in <code className="font-mono text-[10px]">.env.local</code> after{" "}
            <code className="font-mono text-[10px]">npm run tunnel:setup</code>. See{" "}
            <span className="font-mono text-amber-200/90">{PERSISTENT_TUNNEL_DOC_PATH}</span>.
          </p>
        </div>
      ) : null}
      <div
        className={cn(
          "flex items-center gap-1.5",
          compact ? "" : "rounded-lg border border-[#262626] bg-[#161616] p-2",
        )}
      >
        {compact ? null : (
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/70">{shareUrl}</p>
        )}
        <Button
          type="button"
          variant={compact ? "ghost" : "default"}
          size={compact ? "icon-xs" : "sm"}
          onClick={() => void copy()}
          className={
            compact
              ? "size-6 text-white/50 hover:text-white/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }
          aria-label="Copy join link"
        >
          {copied ? <Check strokeWidth={1.5} /> : <Link2 strokeWidth={1.5} />}
          {compact ? null : <span>{copied ? "Copied" : "Copy join link"}</span>}
        </Button>
      </div>
    </div>
  );
}
