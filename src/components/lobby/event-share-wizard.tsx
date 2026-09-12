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
  onDone?: () => void;
};

const TUNNEL_SETUP_COMMAND = "npm run tunnel:setup -- --hostname lobby.YOUR_ZONE --zone YOUR_ZONE";

const ENV_LOCAL_BLOCK = `# Add to .env.local (replace YOUR_ZONE with your Cloudflare zone)
LOBBY_PUBLIC_URL=https://lobby.YOUR_ZONE
NEXT_PUBLIC_LOBBY_PUBLIC_URL=https://lobby.YOUR_ZONE`;

const TUNNEL_INSTALL_COMMAND = "npm run tunnel:install";

const DEV_RESTART_COMMAND = "npm run dev";

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
      <div className="min-w-0 flex-1 space-y-1.5 pb-4">
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

function CopyBlock({ text, multiline = false }: { text: string; multiline?: boolean }) {
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
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 font-mono text-[10px] text-white/55",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate",
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

export function EventShareWizard({ event, joinUrl, onDone }: EventShareWizardProps) {
  const [publicStatus, setPublicStatus] = useState<PublicUrlStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const code = event.eventCode;
  const resolved = useMemo(() => resolveShareJoinUrl(joinUrl), [joinUrl]);
  const shareable = publicStatus?.shareable ?? resolved.isRemoteShareable;

  const shareUrl = useMemo(() => {
    if (shareable && publicStatus?.publicUrl) {
      return `${publicStatus.publicUrl}${publicStatus.joinPath}`;
    }
    if (shareable) {
      return resolved.url;
    }
    return buildJoinUrl(resolved.url.split("/join/")[0] ?? resolved.url, code);
  }, [shareable, publicStatus, code, resolved.url]);

  const publicOrigin = useMemo(() => {
    if (shareable && publicStatus?.publicUrl) {
      return publicStatus.publicUrl;
    }
    try {
      return new URL(shareUrl).origin;
    } catch {
      return "https://lobby.YOUR_ZONE";
    }
  }, [shareable, publicStatus?.publicUrl, shareUrl]);

  const guestMessage = useMemo(
    () =>
      [
        `Join lobby ${code} at ${shareUrl}`,
        "",
        "Tell your Grok Bot:",
        `Join lobby ${code} at ${publicOrigin}`,
        "",
        "Or run:",
        `npm run join-lobby -- --code ${code} --url ${publicOrigin} --name Guest --color cyan --task "Joining the lobby"`,
      ].join("\n"),
    [code, shareUrl, publicOrigin],
  );

  const refreshStatus = useCallback(async () => {
    setPolling(true);
    try {
      const response = await lobbyFetch(`/api/lobby/public-url?code=${encodeURIComponent(code)}`);
      if (response.ok) {
        const body = (await response.json()) as PublicUrlStatus;
        setPublicStatus(body);
      }
    } finally {
      setPolling(false);
    }
  }, [code]);

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

  const reachabilityStatus: StepStatus = shareable ? "complete" : polling ? "in_progress" : "in_progress";
  const shareStatus: StepStatus = shareable ? "complete" : "blocked";

  return (
    <div className="space-y-4">
      <ol className="space-y-0">
        <WizardStep status="complete" title="Create event">
          <p className="font-mono text-[16px] tracking-[0.18em] text-white/90">{code}</p>
          <p className="text-[11px] text-white/45">
            {event.name} · {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </WizardStep>

        <WizardStep status={reachabilityStatus} title={shareable ? "Reachable from anywhere" : "Make it reachable"}>
          {shareable ? (
            <p className="truncate font-mono text-[11px] text-white/55">{publicStatus?.publicUrl ?? publicOrigin}</p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] leading-relaxed text-white/45">
                Right now this link only works on your Mac. <code className="font-mono text-white/55">localhost</code>{" "}
                is not reachable from other devices or the internet — set up a Cloudflare tunnel so guests can join.
              </p>
              <div className="space-y-1.5">
                <CopyBlock text={TUNNEL_SETUP_COMMAND} />
                <CopyBlock text={ENV_LOCAL_BLOCK} multiline />
                <CopyBlock text={TUNNEL_INSTALL_COMMAND} />
                <CopyBlock text={DEV_RESTART_COMMAND} />
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                {polling ? (
                  <p className="text-[10px] text-white/30">Checking for public URL…</p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshStatus()}
                    className="h-7 border-[#262626] bg-transparent px-2.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white/80"
                  >
                    I&apos;ve done this — check again
                  </Button>
                )}
              </div>
            </div>
          )}
        </WizardStep>

        <WizardStep status={shareStatus} title="Share with guests">
          <div className="space-y-2">
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
              <p className="text-[10px] text-white/35">Complete step 2 to unlock the guest link.</p>
            ) : (
              <>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-[#262626] bg-[#161616] p-2 font-mono text-[10px] leading-relaxed text-white/55">
                  {guestMessage}
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyGuestMessage()}
                  className="w-full border-[#262626] bg-transparent text-white/70 hover:bg-white/5"
                >
                  {messageCopied ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />}
                  <span>{messageCopied ? "Message copied" : "Copy message for guest"}</span>
                </Button>
              </>
            )}
          </div>
        </WizardStep>
      </ol>

      {onDone ? (
        <Button
          type="button"
          onClick={onDone}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Done
        </Button>
      ) : null}
    </div>
  );
}
