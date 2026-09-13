"use client";

import { useEffect, useMemo, useState } from "react";

import { CopyBlock } from "@/components/lobby/copy-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildJoinLobbyNpmBlock,
  buildSidecarStartBlock,
  buildZeroFrictionSetupBlock,
} from "@/lib/join-blocks";
import { postSidecarJoin, probeSidecar, SIDECAR_BASE, type SidecarHealth } from "@/lib/local-join-bridge";

type JoinWizardProps = {
  code: string;
  origin: string;
  color?: string;
  onMirrorFallback: () => void;
};

export function JoinWizard({ code, origin, color = "cyan", onMirrorFallback }: JoinWizardProps) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("Joining the lobby");
  const [sidecarOk, setSidecarOk] = useState(false);
  const [sidecarVersion, setSidecarVersion] = useState<string | undefined>();
  const [sidecarProbe, setSidecarProbe] = useState<Pick<SidecarHealth, "reason" | "detail"> | null>(null);
  const [sidecarChecked, setSidecarChecked] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedUserId, setJoinedUserId] = useState<string | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const trimmedName = name.trim();
  const trimmedTask = task.trim() || "Joining the lobby";
  const canJoin = trimmedName.length > 0 && sidecarOk;

  const remoteBlock = useMemo(() => {
    const args = { code, origin, name: trimmedName || "Guest", task: trimmedTask, color };
    return buildZeroFrictionSetupBlock(args);
  }, [code, origin, trimmedName, trimmedTask, color]);

  const sidecarStartBlock = buildSidecarStartBlock();
  const npmBlock = buildJoinLobbyNpmBlock({ code, origin, name: trimmedName || "Guest" });

  useEffect(() => {
    let cancelled = false;

    async function checkSidecar(): Promise<void> {
      const health = await probeSidecar();
      if (cancelled) {
        return;
      }
      setSidecarOk(health.ok);
      setSidecarVersion(health.version);
      setSidecarProbe({ reason: health.reason, detail: health.detail });
      setSidecarChecked(true);
    }

    void checkSidecar();
    const interval = window.setInterval(() => void checkSidecar(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function joinViaSidecar(): Promise<void> {
    if (!canJoin) {
      return;
    }
    setJoinPending(true);
    setJoinError(null);
    try {
      const result = await postSidecarJoin({
        code,
        url: origin,
        name: trimmedName,
        task: trimmedTask,
        color,
      });
      if (result.ok && result.userId) {
        setJoinedUserId(result.userId);
      } else {
        setJoinError(result.error ?? "Join failed.");
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Could not reach local helper.");
    } finally {
      setJoinPending(false);
    }
  }

  if (joinedUserId) {
    return (
      <div className="mt-3 space-y-3">
        <h1 className="text-[17px] font-medium text-emerald-400/95">You&apos;re in the lobby</h1>
        <p className="text-[13px] leading-relaxed text-white/55">
          Joined as <span className="text-white/80">{trimmedName}</span> (
          <code className="font-mono text-[11px]">{joinedUserId}</code>). Heartbeat is running via the local helper
          — keep that terminal open.
        </p>
        <a
          href="/?as=attendee"
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open lobby grid
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <div>
        <h1 className="text-[17px] font-medium text-white/90">Join lobby</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
          {sidecarOk
            ? "Local helper detected — click Join. No copy-paste, no terminal hunting."
            : "Chrome cannot run shell commands (browser security). Start the one-time local helper below, then this page joins for you."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="micro text-white/40">Your name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pablo"
            className="mt-1 h-9 border-[#262626] bg-[#0d0d0d] text-[13px]"
          />
        </label>
        <label className="block">
          <span className="micro text-white/40">Task</span>
          <Input
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="What you're working on"
            className="mt-1 h-9 border-[#262626] bg-[#0d0d0d] text-[13px]"
          />
        </label>
      </div>

      {sidecarOk ? (
        <div className="space-y-2 rounded-md border border-emerald-900/40 bg-emerald-950/20 p-3">
          <p className="text-[12px] text-emerald-400/90">
            Helper ready{sidecarVersion ? ` (v${sidecarVersion})` : ""} at{" "}
            <code className="font-mono">{SIDECAR_BASE}</code>
          </p>
          <Button
            type="button"
            disabled={!canJoin || joinPending}
            className="h-10 w-full bg-primary text-[13px] text-primary-foreground hover:bg-primary/90"
            onClick={() => void joinViaSidecar()}
          >
            {joinPending ? "Joining…" : trimmedName ? `Join as ${trimmedName}` : "Enter your name to join"}
          </Button>
          {joinError ? <p className="text-[12px] text-red-400">{joinError}</p> : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-[#333] bg-[#0a0a0a] p-3">
          <p className="text-[12px] font-medium text-white/80">Step 1 — paste once in Terminal</p>
          <p className="text-[11px] leading-relaxed text-white/45">
            Clones the lobby repo if needed, starts the helper, then this page auto-detects it — no refresh.
          </p>
          <CopyBlock text={sidecarStartBlock} multiline />
          <SidecarWaitStatus checked={sidecarChecked} probe={sidecarProbe} />
        </div>
      )}

      <button
        type="button"
        className="text-[11px] text-white/35 underline-offset-2 hover:text-white/55 hover:underline"
        onClick={() => setShowRemote(!showRemote)}
      >
        {showRemote ? "Hide" : "Show"} remote join (Agent Computer on another machine)
      </button>

      {showRemote ? (
        <div className="space-y-2 rounded-md border border-[#262626] bg-[#0d0d0d] p-3">
          <p className="text-[11px] leading-relaxed text-white/45">
            Only if Grok Bot is on a different machine than this browser — paste into Agent Computer.
          </p>
          <CopyBlock text={remoteBlock} multiline />
        </div>
      ) : null}

      <button
        type="button"
        className="text-[11px] text-white/35 underline-offset-2 hover:text-white/55 hover:underline"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "Hide" : "Show"} other options
      </button>

      {showAdvanced ? (
        <div className="space-y-3 border-t border-[#262626] pt-3">
          <div className="space-y-1.5">
            <p className="text-[11px] text-white/40">Clone repo + join-lobby CLI</p>
            <CopyBlock text={npmBlock} multiline />
          </div>
          <button
            type="button"
            className="block text-[11px] text-white/35 underline-offset-2 hover:underline"
            onClick={onMirrorFallback}
          >
            Browser mirror only (tab must stay open)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidecarWaitStatus({
  checked,
  probe,
}: {
  checked: boolean;
  probe: Pick<SidecarHealth, "reason" | "detail"> | null;
}) {
  if (!checked) {
    return <p className="text-[11px] text-white/35">Checking for helper at {SIDECAR_BASE}…</p>;
  }

  const pageOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const pageIsLocalhost =
    pageOrigin.startsWith("http://127.0.0.1:") || pageOrigin.startsWith("http://localhost:");

  if (probe?.reason === "blocked" && !pageIsLocalhost) {
    return (
      <div className="space-y-1 text-[11px] leading-relaxed text-amber-400/90">
        <p>
          Browser blocked localhost from this HTTPS page (Private Network Access). One-click join needs the join
          page on <code className="font-mono">http://127.0.0.1</code>, or use remote join below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[11px] leading-relaxed text-white/40">
      <p className="text-white/35">Waiting for helper at {SIDECAR_BASE}…</p>
      <p>
        Paste the block above in Terminal on the <span className="text-white/60">same machine as this browser tab</span>.
        Leave that terminal open. If you ran it on a different computer, this page will never detect it.
      </p>
      {probe?.reason === "not_running" ? (
        <p className="text-white/30">Not reachable yet — still starting, or command not run on this machine.</p>
      ) : null}
    </div>
  );
}
