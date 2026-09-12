"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Circle, Copy, Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lobbyFetch } from "@/lib/client";
import type { Event } from "@/lib/domain";
import { joinUrl as buildJoinUrl, resolveShareJoinUrl, type PublicUrlStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "in_progress" | "complete" | "blocked";

type EventShareWizardProps = {
  event: Event;
  joinUrl: string;
};

const TUNNEL_SETUP_COMMANDS = [
  "npm run tunnel:setup -- --hostname lobby.yourdomain.com --zone yourdomain.com",
  "cp .env.local.example .env.local",
  "# Set LOBBY_PUBLIC_URL and NEXT_PUBLIC_LOBBY_PUBLIC_URL to your tunnel hostname",
  "npm run dev",
] as const;

function stepIcon(status: StepStatus): ReactNode {
  switch (status) {
    case "complete":
      return <Check className="size-3.5 text-emerald-400" strokeWidth={2} />;
    case "in_progress":
      return <Loader2 className="size-3.5 animate-spin text-white/50" strokeWidth={1.5} />;
    case "blocked":
      return <Circle className="size-3.5 text-white/20" strokeWidth={1.5} />;
    case "pending":
      return <Circle className="size-3.5 text-white/35" strokeWidth={1.5} />;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function WizardStep({
  status,
  title,
  children,
}: {
  status: StepStatus;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
          status === "complete"
            ? "border-emerald-500/40 bg-emerald-500/10"
            : status === "in_progress"
              ? "border-white/20 bg-white/5"
              : "border-white/10 bg-transparent",
        )}
      >
        {stepIcon(status)}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pb-3">
        <p
          className={cn(
            "text-[12px] font-medium transition-colors duration-300",
            status === "complete" ? "text-white/85" : status === "blocked" ? "text-white/30" : "text-white/60",
          )}
        >
          {title}
        </p>
        {children}
      </div>
    </li>
  );
}

function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (text.startsWith("#")) {
    return <p className="font-mono text-[10px] text-white/35">{text}</p>;
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-[#262626] bg-[#0d0d0d] px-2 py-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/55">{text}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 text-white/35 hover:text-white/70"
        aria-label="Copy command"
      >
        {copied ? <Check className="size-3" strokeWidth={1.5} /> : <Copy className="size-3" strokeWidth={1.5} />}
      </button>
    </div>
  );
}

export function EventShareWizard({ event, joinUrl }: EventShareWizardProps) {
  const [publicStatus, setPublicStatus] = useState<PublicUrlStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const code = event.eventCode;
  const resolved = useMemo(() => resolveShareJoinUrl(joinUrl), [joinUrl]);
  const shareable = publicStatus?.shareable ?? resolved.isRemoteShareable;

  const shareUrl = useMemo(() => {
    if (shareable && publicStatus?.publicUrl) {
      return buildJoinUrl(publicStatus.publicUrl, code);
    }
    return resolved.url;
  }, [shareable, publicStatus?.publicUrl, code, resolved.url]);

  const guestMessage = useMemo(() => {
    const origin = shareable ? new URL(shareUrl).origin : "https://lobby.yourdomain.com";
    return `Join lobby ${code} at ${shareUrl}\n\nTell your Grok Bot:\nJoin lobby ${code} at ${origin}`;
  }, [code, shareUrl, shareable]);

  const refreshStatus = useCallback(async () => {
    setPolling(true);
    try {
      const response = await lobbyFetch("/api/lobby/public-url");
      if (response.ok) {
        const body = (await response.json()) as PublicUrlStatus;
        setPublicStatus(body);
      }
    } finally {
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (shareable) {
      return;
    }
    const timer = window.setInterval(() => void refreshStatus(), 4000);
    return () => window.clearInterval(timer);
  }, [shareable, refreshStatus]);

  useEffect(() => {
    if (!linkCopied) {
      return;
    }
    const timer = window.setTimeout(() => setLinkCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [linkCopied]);

  useEffect(() => {
    if (!messageCopied) {
      return;
    }
    const timer = window.setTimeout(() => setMessageCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [messageCopied]);

  async function copyShareLink(): Promise<void> {
    if (!shareable) {
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    await lobbyFetch("/api/events/share", {
      method: "POST",
      body: JSON.stringify({ eventId: event.id }),
    });
  }

  async function copyGuestMessage(): Promise<void> {
    if (!shareable) {
      return;
    }
    await navigator.clipboard.writeText(guestMessage);
    setMessageCopied(true);
    await lobbyFetch("/api/events/share", {
      method: "POST",
      body: JSON.stringify({ eventId: event.id }),
    });
  }

  const publicUrlStatus: StepStatus = shareable ? "complete" : polling ? "in_progress" : "in_progress";
  const shareLinkStatus: StepStatus = shareable ? "complete" : "blocked";
  const guestStatus: StepStatus = shareable ? "complete" : "blocked";

  return (
    <div className="space-y-3">
      <p className="font-mono text-[18px] tracking-[0.2em] text-white/90">{code}</p>
      <ol className="space-y-0">
        <WizardStep status="complete" title="Create event">
          <p className="text-[11px] text-white/45">
            {event.name} · {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </WizardStep>

        <WizardStep
          status={publicUrlStatus}
          title={shareable ? "Public URL ready" : "Set up public URL"}
        >
          {shareable ? (
            <p className="truncate font-mono text-[11px] text-emerald-400/90">{publicStatus?.publicUrl ?? shareUrl}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] leading-relaxed text-white/45">
                Run tunnel setup, add your hostname to <code className="font-mono text-white/55">.env.local</code>, then
                restart dev. We&apos;ll detect when it&apos;s ready.
              </p>
              <div className="space-y-1">
                {TUNNEL_SETUP_COMMANDS.map((command) => (
                  <CopyCommand key={command} text={command} />
                ))}
              </div>
              {polling ? (
                <p className="text-[10px] text-white/30">Checking for public URL…</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void refreshStatus()}
                  className="text-[10px] text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
                >
                  Check again
                </button>
              )}
            </div>
          )}
        </WizardStep>

        <WizardStep status={shareLinkStatus} title="Share link">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border p-2 transition-opacity duration-300",
              shareable ? "border-[#262626] bg-[#161616]" : "border-[#262626]/60 bg-[#161616]/50 opacity-60",
            )}
          >
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/70">{shareUrl}</p>
            <Button
              type="button"
              size="sm"
              disabled={!shareable}
              onClick={() => void copyShareLink()}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {linkCopied ? <Check strokeWidth={1.5} /> : <Link2 strokeWidth={1.5} />}
              <span>{linkCopied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
          {!shareable ? (
            <p className="text-[10px] text-white/35">Complete step 2 to unlock a remote join link.</p>
          ) : null}
        </WizardStep>

        <WizardStep status={guestStatus} title="Send to guest">
          <div className="space-y-2">
            <pre
              className={cn(
                "max-h-24 overflow-auto whitespace-pre-wrap rounded-lg border p-2 font-mono text-[10px] leading-relaxed",
                shareable
                  ? "border-[#262626] bg-[#161616] text-white/55"
                  : "border-[#262626]/60 bg-[#161616]/50 text-white/30",
              )}
            >
              {guestMessage}
            </pre>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!shareable}
              onClick={() => void copyGuestMessage()}
              className="w-full border-[#262626] bg-transparent text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              {messageCopied ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />}
              <span>{messageCopied ? "Message copied" : "Copy message for guest"}</span>
            </Button>
          </div>
        </WizardStep>
      </ol>
    </div>
  );
}
