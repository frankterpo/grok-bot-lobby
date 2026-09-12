"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Circle, Copy, Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const TUNNEL_INSTALL_COMMAND = "npm run tunnel:install";
const DEV_RESTART_COMMAND = "npm run dev";

function normalizeHostnameInput(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? host;
  host = host.split(":")[0] ?? host;
  host = host.replace(/\.$/, "");

  if (!host) {
    return host;
  }

  const labels = host.split(".").filter(Boolean);
  if (labels.length === 2) {
    return `lobby.${host}`;
  }

  return host;
}

function zoneFromHostname(hostname: string): string {
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname;
  }
  return labels.slice(-2).join(".");
}

function buildEnvPreview(publicUrl: string): string {
  return `LOBBY_PUBLIC_URL=${publicUrl}\nNEXT_PUBLIC_LOBBY_PUBLIC_URL=${publicUrl}`;
}

function buildTunnelSetupCommand(hostname: string, zone: string): string {
  return `npm run tunnel:setup -- --hostname ${hostname} --zone ${zone}`;
}

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

  const [hostnameInput, setHostnameInput] = useState("");
  const [envPreview, setEnvPreview] = useState<string | null>(null);
  const [savedHostname, setSavedHostname] = useState<string | null>(null);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const code = event.eventCode;
  const resolved = useMemo(() => resolveShareJoinUrl(joinUrl), [joinUrl]);
  const shareable = publicStatus?.shareable ?? resolved.isRemoteShareable;

  const normalizedHostname = useMemo(() => normalizeHostnameInput(hostnameInput), [hostnameInput]);
  const zone = useMemo(
    () => (normalizedHostname ? zoneFromHostname(normalizedHostname) : ""),
    [normalizedHostname],
  );
  const previewPublicUrl = normalizedHostname ? `https://${normalizedHostname}` : null;
  const tunnelSetupCommand = normalizedHostname
    ? buildTunnelSetupCommand(normalizedHostname, zone)
    : buildTunnelSetupCommand("lobby.YOUR_ZONE", "YOUR_ZONE");

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
    if (previewPublicUrl) {
      return previewPublicUrl;
    }
    try {
      return new URL(shareUrl).origin;
    } catch {
      return "https://lobby.YOUR_ZONE";
    }
  }, [shareable, publicStatus?.publicUrl, previewPublicUrl, shareUrl]);

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
        if (body.shareable) {
          setPendingRestart(false);
        }
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

  function generateEnvConfig(): void {
    if (!previewPublicUrl) {
      setSaveMessage("Enter a hostname or zone first.");
      setSaveState("error");
      return;
    }
    setEnvPreview(buildEnvPreview(previewPublicUrl));
    setSaveState("idle");
    setSaveMessage(null);
  }

  async function saveEnvLocal(): Promise<void> {
    if (!hostnameInput.trim()) {
      setSaveMessage("Enter a hostname or zone first.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setSaveMessage(null);

    try {
      const response = await lobbyFetch("/api/lobby/configure-public-url", {
        method: "POST",
        body: JSON.stringify({ hostname: hostnameInput.trim() }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        publicUrl?: string;
        hostname?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setSaveState("error");
        setSaveMessage(body.error ?? "Could not save .env.local.");
        return;
      }

      if (body.publicUrl) {
        setEnvPreview(buildEnvPreview(body.publicUrl));
      }
      if (body.hostname) {
        setSavedHostname(body.hostname);
        setHostnameInput(body.hostname);
      }
      setPendingRestart(true);
      setSaveState("saved");
      setSaveMessage(body.message ?? "Saved .env.local — restart npm run dev to apply.");
    } catch {
      setSaveState("error");
      setSaveMessage("Could not save .env.local.");
    }
  }

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

  const reachabilityStatus: StepStatus = shareable
    ? "complete"
    : pendingRestart
      ? "in_progress"
      : polling
        ? "in_progress"
        : "in_progress";
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
                is not reachable from other devices or the internet — configure your public hostname, save{" "}
                <code className="font-mono text-white/55">.env.local</code>, set up the Cloudflare tunnel, then restart
                dev.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="public-hostname" className="text-[10px] font-medium text-white/50">
                  Public hostname
                </label>
                <Input
                  id="public-hostname"
                  value={hostnameInput}
                  onChange={(event) => {
                    setHostnameInput(event.target.value);
                    setEnvPreview(null);
                    setSaveState("idle");
                    setSaveMessage(null);
                  }}
                  placeholder="lobby.example.com or example.com"
                  className="h-8 border-[#262626] bg-[#0d0d0d] font-mono text-[11px] text-white/75 placeholder:text-white/25"
                />
                {normalizedHostname && normalizedHostname !== hostnameInput.trim().toLowerCase() ? (
                  <p className="text-[10px] text-white/35">Will use {normalizedHostname}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!hostnameInput.trim()}
                  onClick={generateEnvConfig}
                  className="h-7 border-[#262626] bg-transparent px-2.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white/80"
                >
                  Generate env config
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!hostnameInput.trim() || saveState === "saving"}
                  onClick={() => void saveEnvLocal()}
                  className="h-7 bg-primary px-2.5 text-[11px] text-primary-foreground hover:bg-primary/90"
                >
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                      Saving…
                    </>
                  ) : (
                    "Save to .env.local"
                  )}
                </Button>
              </div>

              {envPreview ? <CopyBlock text={envPreview} multiline /> : null}

              {saveMessage ? (
                <p
                  className={cn(
                    "text-[10px] leading-relaxed",
                    saveState === "error" ? "text-red-400/80" : "text-emerald-400/80",
                  )}
                >
                  {saveMessage}
                </p>
              ) : null}

              {pendingRestart ? (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-2.5 py-2">
                  <p className="text-[10px] leading-relaxed text-amber-200/80">
                    Restart dev server to apply — Next.js only reads <code className="font-mono">.env.local</code> at
                    startup.
                  </p>
                  <div className="mt-1.5">
                    <CopyBlock text={DEV_RESTART_COMMAND} />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5 pt-0.5">
                <p className="text-[10px] font-medium text-white/45">
                  {savedHostname ? "3" : "2"}. Run tunnel setup (same hostname)
                </p>
                <CopyBlock text={tunnelSetupCommand} />
                <CopyBlock text={TUNNEL_INSTALL_COMMAND} />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {polling ? (
                  <p className="text-[10px] text-white/30">
                    {pendingRestart ? "Waiting for restart — checking public URL…" : "Checking for public URL…"}
                  </p>
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
              <p className="text-[10px] text-white/35">
                {pendingRestart
                  ? "Restart npm run dev, then complete tunnel setup to unlock the guest link."
                  : "Complete step 2 to unlock the guest link."}
              </p>
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
