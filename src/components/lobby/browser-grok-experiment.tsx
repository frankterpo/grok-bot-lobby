"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildCurlBlockForTab,
  fsAccessSupported,
  pickSkillFolder,
  probeDefaultGateways,
  probeLocalSkillFolder,
  probeOpfsPersistence,
  type LocalFolderProbe,
  type LocalhostGatewayProbe,
  type OpfsProbe,
} from "@/lib/browser-grok-probe";
import { lobbyFetch, rememberEventCode, writeSlot } from "@/lib/client";
import type { ShareLevel } from "@/lib/domain";
import { clientLobbyOrigin } from "@/lib/format";

type BrowserGrokExperimentProps = {
  code: string;
  shareLevel: ShareLevel;
  onJoined: () => void;
};

export function BrowserGrokExperiment({ code, shareLevel, onJoined }: BrowserGrokExperimentProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState("Joining from browser tab");
  const [folderProbe, setFolderProbe] = useState<LocalFolderProbe | null>(null);
  const [gatewayProbes, setGatewayProbes] = useState<LocalhostGatewayProbe[] | null>(null);
  const [opfsProbe, setOpfsProbe] = useState<OpfsProbe | null>(null);
  const [curlBlock, setCurlBlock] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function probeFolder(): Promise<void> {
    setPending(true);
    setStatus(null);
    try {
      const handle = await pickSkillFolder();
      const result = await probeLocalSkillFolder(handle);
      setFolderProbe(result);
      if (result.hasGrokbotScript) {
        setCurlBlock(
          buildCurlBlockForTab({
            code,
            origin: clientLobbyOrigin(),
            name: name.trim() || "YOUR_NAME",
            task: task.trim() || "Joining the lobby",
          }),
        );
      }
      setStatus(result.readError ?? "Folder readable. Copy curl block below for Agent Computer.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read folder.");
    } finally {
      setPending(false);
    }
  }

  async function probeGateway(): Promise<void> {
    setPending(true);
    setStatus(null);
    try {
      const results = await probeDefaultGateways();
      setGatewayProbes(results);
      setStatus("Localhost probes finished. Remote lobby origins cannot reach your gateway without CORS + token.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gateway probe failed.");
    } finally {
      setPending(false);
    }
  }

  async function probeOpfs(): Promise<void> {
    setPending(true);
    setStatus(null);
    try {
      const result = await probeOpfsPersistence();
      setOpfsProbe(result);
      setStatus(result.detail);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "OPFS probe failed.");
    } finally {
      setPending(false);
    }
  }

  async function joinWithTabHeartbeat(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("Enter a display name.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const claimResponse = await lobbyFetch("/api/bots/claim", {
        method: "POST",
        body: JSON.stringify({
          eventCode: code,
          name: trimmed,
          botColor: "cyan",
          shareLevel,
          hasGrokBot: true,
          acceptPermissions: true,
        }),
      });
      const claimBody = (await claimResponse.json()) as {
        error?: string;
        userId?: string;
        eventId?: string;
      };
      if (!claimResponse.ok || !claimBody.userId || !claimBody.eventId) {
        setStatus(claimBody.error ?? "Claim failed.");
        return;
      }

      await lobbyFetch("/api/lobby/sync", {
        method: "POST",
        body: JSON.stringify({
          eventId: claimBody.eventId,
          botId: claimBody.userId,
          taskLabel: task.trim() || "Joining from browser tab",
          status: "working",
          shareLevel,
        }),
      });

      setStatus(
        "Claimed with hasGrokBot:true and synced task. Lobby heartbeats while this tab stays open — this does not spawn grokbot.py or read sand-data.",
      );
      rememberEventCode(code);
      writeSlot("attendee");
      onJoined();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Join failed.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="block text-[11px] text-amber-500/70 underline-offset-2 hover:text-amber-400 hover:underline"
        onClick={() => setOpen(true)}
      >
        Experimental: what can Chrome do locally?
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-amber-200/90">Browser limits vs Grok Bot</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            Chrome cannot silently read <code className="font-mono">~/.cursor/skills</code> or{" "}
            <code className="font-mono">/home/box/sand-data</code>. These probes show what a user gesture
            can reach — not true Grok Bot wiring.
          </p>
        </div>
        <button
          type="button"
          className="text-[11px] text-white/35 hover:text-white/55"
          onClick={() => setOpen(false)}
        >
          Hide
        </button>
      </div>

      <div className="space-y-2">
        <p className="micro text-white/40">1) Pick a local folder (File System Access API)</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !fsAccessSupported()}
          className="h-8 border-[#262626] bg-[#0d0d0d] text-[11px]"
          onClick={() => void probeFolder()}
        >
          {fsAccessSupported() ? "Choose grok-bot skill folder…" : "FS API unavailable (non-Chromium)"}
        </Button>
        {folderProbe ? (
          <pre className="max-h-32 overflow-auto rounded border border-[#262626] bg-[#0d0d0d] p-2 text-[10px] text-white/55">
            {JSON.stringify(folderProbe, null, 2)}
          </pre>
        ) : null}
        {curlBlock ? (
          <div className="space-y-1">
            <p className="micro text-white/40">Generated curl block (paste into Agent Computer)</p>
            <pre className="max-h-40 overflow-auto rounded border border-[#262626] bg-[#0d0d0d] p-2 text-[10px] text-emerald-200/70 whitespace-pre-wrap">
              {curlBlock}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="micro text-white/40">1b) Origin Private File System (same-origin persistence)</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="h-8 border-[#262626] bg-[#0d0d0d] text-[11px]"
          onClick={() => void probeOpfs()}
        >
          Probe OPFS (navigator.storage.getDirectory)
        </Button>
        {opfsProbe ? (
          <pre className="max-h-24 overflow-auto rounded border border-[#262626] bg-[#0d0d0d] p-2 text-[10px] text-white/55">
            {JSON.stringify(opfsProbe, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="micro text-white/40">2) Probe localhost gateway (CORS test)</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="h-8 border-[#262626] bg-[#0d0d0d] text-[11px]"
          onClick={() => void probeGateway()}
        >
          Fetch 127.0.0.1:1340/health
        </Button>
        {gatewayProbes ? (
          <pre className="max-h-32 overflow-auto rounded border border-[#262626] bg-[#0d0d0d] p-2 text-[10px] text-white/55">
            {JSON.stringify(gatewayProbes, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="micro text-white/40">3) Tab join with hasGrokBot:true (flag only)</p>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Display name"
          className="h-8 border-[#262626] bg-[#0d0d0d] text-[11px]"
        />
        <Input
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder="Task label"
          className="h-8 border-[#262626] bg-[#0d0d0d] text-[11px]"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="h-8 bg-primary text-[11px] text-primary-foreground"
          onClick={() => void joinWithTabHeartbeat()}
        >
          Claim + sync (tab heartbeat)
        </Button>
      </div>

      {status ? <p className="text-[11px] text-white/50">{status}</p> : null}
    </div>
  );
}
