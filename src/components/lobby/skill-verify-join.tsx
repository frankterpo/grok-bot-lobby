"use client";

import { useEffect, useMemo, useState } from "react";

import { CopyBlock } from "@/components/lobby/copy-block";
import { Button } from "@/components/ui/button";
import {
  buildJoinBlockFromPayload,
  fsAccessSupported,
  pickSkillFolder,
  probeLocalSkillFolder,
  toSkillVerification,
  type SkillVerification,
} from "@/lib/browser-grok-probe";
import { postSidecarJoin, probeSidecar, SIDECAR_BASE } from "@/lib/local-join-bridge";

type SkillVerifyJoinProps = {
  code: string;
  origin: string;
  name: string;
  task: string;
  color?: string;
};

export function SkillVerifyJoin({ code, origin, name, task, color = "cyan" }: SkillVerifyJoinProps) {
  const [verification, setVerification] = useState<SkillVerification | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sidecarOk, setSidecarOk] = useState(false);
  const [sidecarVersion, setSidecarVersion] = useState<string | undefined>();
  const [bridgePending, setBridgePending] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [bridgeUserId, setBridgeUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSidecar(): Promise<void> {
      const health = await probeSidecar();
      if (cancelled) {
        return;
      }
      setSidecarOk(health.ok);
      setSidecarVersion(health.version);
    }

    void checkSidecar();
    const interval = setInterval(() => void checkSidecar(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const curlBlock = useMemo(() => {
    if (!verification?.hasGrokbotScript) {
      return null;
    }
    const trimmedName = name.trim();
    const trimmedTask = task.trim();
    if (!trimmedName || !trimmedTask) {
      return null;
    }
    return buildJoinBlockFromPayload({
      code,
      origin,
      name: trimmedName,
      task: trimmedTask,
      color,
    });
  }, [verification, code, origin, name, task, color]);

  async function verifySkillFolder(): Promise<void> {
    setPending(true);
    setVerifyError(null);
    try {
      const handle = await pickSkillFolder();
      const probe = await probeLocalSkillFolder(handle);
      const next = toSkillVerification(probe);
      setVerification(next);
      if (!next.hasGrokbotScript) {
        setVerifyError(
          probe.readError ??
            "No scripts/grokbot.py found. Pick the root of your adamanz grok-bot skill install.",
        );
      }
    } catch (error) {
      setVerification(null);
      setVerifyError(error instanceof Error ? error.message : "Could not read folder.");
    } finally {
      setPending(false);
    }
  }

  const skillOk = verification?.hasGrokbotScript === true;
  const trimmedName = name.trim();
  const trimmedTask = task.trim();
  const canBridge = sidecarOk && trimmedName.length > 0 && trimmedTask.length > 0;

  async function connectViaBridge(): Promise<void> {
    if (!canBridge) {
      return;
    }
    setBridgePending(true);
    setBridgeError(null);
    setBridgeUserId(null);
    try {
      const result = await postSidecarJoin({
        code,
        url: origin,
        name: trimmedName,
        task: trimmedTask,
        color,
      });
      if (result.ok && result.userId) {
        setBridgeUserId(result.userId);
      } else {
        setBridgeError(result.error ?? "Local bridge join failed.");
      }
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : "Could not reach local bridge.");
    } finally {
      setBridgePending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-[#262626] bg-[#0d0d0d] p-3">
      <div>
        <p className="text-[12px] font-medium text-white/85">Verify grok-bot skill</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          Chrome can read a folder you pick to confirm <code className="font-mono">scripts/grokbot.py</code> and
          generate a join block. This does <span className="text-white/60">not</span> connect to Agent Computer or
          run grokbot.py — paste the block below when ready.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !fsAccessSupported()}
        className="h-8 border-[#262626] bg-[#111] text-[11px]"
        onClick={() => void verifySkillFolder()}
      >
        {fsAccessSupported() ? "Pick grok-bot skill folder…" : "Folder picker unavailable (use Chromium)"}
      </Button>

      {verifyError ? <p className="text-[11px] text-amber-400/90">{verifyError}</p> : null}

      {verification ? (
        <div className="space-y-2">
          <p className="text-[11px] text-white/50">
            {skillOk ? (
              <>
                <span className="text-emerald-400/90">Skill OK</span>
                {verification.folderName ? ` — ${verification.folderName}` : null}
              </>
            ) : (
              "Folder picked — grok-bot skill not detected."
            )}
          </p>
          {verification.skillMdPreview ? (
            <div className="space-y-1">
              <p className="micro text-white/40">SKILL.md preview</p>
              <pre className="max-h-28 overflow-auto rounded border border-[#262626] bg-[#111] p-2 text-[10px] leading-relaxed text-white/55 whitespace-pre-wrap">
                {verification.skillMdPreview}
                {verification.skillMdPreview.length >= 160 ? "…" : ""}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {curlBlock ? (
        <div className="space-y-1.5">
          <p className="micro text-white/40">Join block — paste into Grok Bot Agent Computer</p>
          <CopyBlock text={curlBlock} multiline />
        </div>
      ) : skillOk ? (
        <p className="text-[11px] text-white/40">Enter your name and task above to generate the join block.</p>
      ) : null}

      <div className="border-t border-[#262626] pt-3 space-y-2">
        <div>
          <p className="text-[12px] font-medium text-white/85">Connect via local bridge</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            If <code className="font-mono">npm run local-join-bridge</code> is running on this machine, join without
            pasting — the sidecar spawns the same heartbeat loop as the curl block.
          </p>
        </div>

        {sidecarOk ? (
          <p className="text-[11px] text-emerald-400/90">
            Sidecar reachable{sidecarVersion ? ` (v${sidecarVersion})` : ""} at{" "}
            <code className="font-mono">{SIDECAR_BASE}</code>
          </p>
        ) : (
          <p className="text-[11px] text-white/40">
            Sidecar not detected. In a terminal on this machine run{" "}
            <code className="font-mono">npm run local-join-bridge</code>, then refresh.
          </p>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canBridge || bridgePending}
          className="h-8 w-full border-[#262626] bg-[#111] text-[11px]"
          title={
            !sidecarOk
              ? `Start local sidecar at ${SIDECAR_BASE}`
              : !trimmedName || !trimmedTask
                ? "Enter name and task above"
                : "POST join to local sidecar"
          }
          onClick={() => void connectViaBridge()}
        >
          {bridgePending ? "Connecting…" : "Connect via local bridge"}
        </Button>

        {bridgeError ? <p className="text-[11px] text-amber-400/90">{bridgeError}</p> : null}

        {bridgeUserId ? (
          <p className="text-[11px] text-emerald-400/90">
            Joined as <code className="font-mono">{bridgeUserId}</code> — heartbeat loop running in the sidecar.
            Keep <code className="font-mono">local-join-bridge</code> open.
          </p>
        ) : null}
      </div>
    </div>
  );
}
