"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { PermissionsWalkthrough } from "@/components/lobby/permissions-walkthrough";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { lobbyFetch, rememberEventCode, writeSlot } from "@/lib/client";
import {
  BOT_COLORS,
  CLAIM_COLORS,
  SHARE_LEVELS,
  shareLevelCopy,
  shareLevelDescription,
  type ShareLevel,
} from "@/lib/domain";
import { assertNever } from "@/lib/domain";
import { clientLobbyOrigin } from "@/lib/format";

type JoinPath = "pick" | "returning" | "new-explain" | "new-claim";

type JoinFlowProps = {
  code: string;
};

export function JoinFlow({ code }: JoinFlowProps) {
  const router = useRouter();
  const [path, setPath] = useState<JoinPath>("pick");
  const origin = clientLobbyOrigin();
  const [name, setName] = useState("Reed");
  const [color, setColor] = useState<string>(BOT_COLORS.cyan);
  const [shareLevel, setShareLevel] = useState<ShareLevel>("label+status");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [hasGrokBot, setHasGrokBot] = useState(true);
  const [claimName, setClaimName] = useState(name);
  const [claimColor, setClaimColor] = useState(color);

  async function claim(args: { name: string; botColor: string; grok: boolean }): Promise<void> {
    setPending(true);
    setError(null);
    writeSlot("attendee");
    const response = await lobbyFetch("/api/bots/claim", {
      method: "POST",
      body: JSON.stringify({
        eventCode: code,
        name: args.name,
        botColor: args.botColor,
        shareLevel,
        hasGrokBot: args.grok,
        acceptPermissions: false,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Could not claim this bot.");
      return;
    }
    rememberEventCode(code);
    setHasGrokBot(args.grok);
    setPermissionsOpen(true);
  }

  async function acceptPermissions(): Promise<void> {
    setPermissionsOpen(false);
    const snapshotResponse = await lobbyFetch("/api/lobby/snapshot?code=" + encodeURIComponent(code));
    const snapshot = (await snapshotResponse.json()) as { event?: { id: string } };
    if (snapshot.event?.id) {
      await lobbyFetch("/api/bots/prefs", {
        method: "POST",
        body: JSON.stringify({
          eventId: snapshot.event.id,
          permissionsAccepted: true,
          shareLevel,
          hasGrokBot,
        }),
      });
    }
    router.push("/?as=attendee");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
      <div className="w-full max-w-md rounded-lg border border-[#262626] bg-[#111] p-5">
        <p className="micro text-white/45">Event {code.toUpperCase()}</p>
        {joinBody({
          path,
          code,
          origin,
          name,
          color,
          shareLevel,
          pending,
          error,
          setPath,
          setName,
          setColor,
          setShareLevel,
          setClaimName,
          setClaimColor,
          claimName,
          claimColor,
          claim,
        })}
      </div>
      <PermissionsWalkthrough
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        onAccept={() => void acceptPermissions()}
      />
    </div>
  );
}

function joinBody(args: {
  path: JoinPath;
  code: string;
  origin: string;
  name: string;
  color: string;
  shareLevel: ShareLevel;
  pending: boolean;
  error: string | null;
  setPath: (path: JoinPath) => void;
  setName: (name: string) => void;
  setColor: (color: string) => void;
  setShareLevel: (level: ShareLevel) => void;
  claimName: string;
  claimColor: string;
  setClaimName: (name: string) => void;
  setClaimColor: (color: string) => void;
  claim: (input: { name: string; botColor: string; grok: boolean }) => Promise<void>;
}): ReactNode {
  switch (args.path) {
    case "pick":
      return (
        <div className="mt-3">
          <h1 className="text-[16px] font-medium text-white/90">Join via Grok Bot</h1>
          <p className="mt-2 text-[12px] text-white/50">
            This page is a mirror. Tell your bot: Join lobby {args.code} at this URL. Permissions live in standing
            rules, not this form.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-[#262626] bg-[#0d0d0d] p-2 text-[11px] text-white/70">
            {`npm run join-lobby -- --code ${args.code} --url ${args.origin} --name Alice --color cyan --task "Setting up event credits"`}
          </pre>
          {args.error ? <p className="mt-3 text-[12px] text-red-400">{args.error}</p> : null}
          <button
            type="button"
            className="mt-4 text-[11px] text-white/35 underline-offset-2 hover:underline"
            onClick={() => args.setPath("new-explain")}
          >
            Fallback: claim from this browser
          </button>
        </div>
      );
    case "returning":
      return (
        <div className="mt-3 space-y-3">
          <h1 className="text-[16px] font-medium text-white/90">Walk Reed in</h1>
          <p className="text-[12px] text-white/50">
            Your existing bot appears in the grid. Optionally tighten what the room sees.
          </p>
          <ShareSelect value={args.shareLevel} onChange={args.setShareLevel} />
          {args.error ? <p className="text-[12px] text-red-400">{args.error}</p> : null}
          <Button
            type="button"
            disabled={args.pending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void args.claim({ name: "Reed", botColor: BOT_COLORS.cyan, grok: true })}
          >
            Join lobby
          </Button>
        </div>
      );
    case "new-explain":
      return (
        <div className="mt-3 space-y-3">
          <h1 className="text-[16px] font-medium text-white/90">Your Grok Bot joins this event…</h1>
          <p className="text-[12px] leading-relaxed text-white/55">
            I&apos;m not a video tile. I&apos;m a bot with your name, a color, and a live task token. The lobby sees
            what you&apos;re working on — not your workspace.
          </p>
          <Button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => args.setPath("new-claim")}
          >
            Continue
          </Button>
        </div>
      );
    case "new-claim":
      return (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void args.claim({ name: args.claimName, botColor: args.claimColor, grok: false });
          }}
        >
          <h1 className="text-[16px] font-medium text-white/90">Name your bot</h1>
          <Input
            value={args.claimName}
            onChange={(event) => args.setClaimName(event.target.value)}
            placeholder="Your name"
            className="border-[#262626] bg-[#0d0d0d] text-[12px]"
          />
          <div className="flex gap-2">
            {CLAIM_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => args.setClaimColor(swatch)}
                className="size-7 rounded-full border"
                style={{
                  background: swatch,
                  outline: args.claimColor === swatch ? "1.5px solid #e8e8e8" : "1px solid #262626",
                }}
              />
            ))}
          </div>
          <ShareSelect value={args.shareLevel} onChange={args.setShareLevel} />
          {args.error ? <p className="text-[12px] text-red-400">{args.error}</p> : null}
          <Button
            type="submit"
            disabled={args.pending || args.claimName.trim().length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Join lobby
          </Button>
        </form>
      );
    default:
      return assertNever(args.path, "join path");
  }
}

function ShareSelect({
  value,
  onChange,
}: {
  value: ShareLevel;
  onChange: (value: ShareLevel) => void;
}) {
  return (
    <label className="block">
      <span className="micro text-white/40">Share level (optional)</span>
      <Select value={value} onValueChange={(next) => onChange(next as ShareLevel)}>
        <SelectTrigger size="sm" className="mt-1 h-8 w-full border-[#262626] bg-[#0d0d0d] text-[12px]">
          <span className="flex-1 truncate text-left">{shareLevelCopy(value)}</span>
        </SelectTrigger>
        <SelectContent className="bg-[#161616]">
          {SHARE_LEVELS.map((item) => (
            <SelectItem key={item} value={item}>
              <span className="block">
                <span className="text-[12px] text-white/90">{shareLevelCopy(item)}</span>
                <span className="mt-0.5 block text-[10px] text-white/40">
                  {shareLevelDescription(item)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-[11px] text-white/35">{shareLevelDescription(value)}</p>
    </label>
  );
}
