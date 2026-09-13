"use client";

import { Button } from "@/components/ui/button";
import type { Attendee, LobbyToken, Squad } from "@/lib/domain";

export type ProposeTarget = { toBotId?: string; toSquadId?: string };

type TokenProposeDialogProps = {
  open: boolean;
  target: ProposeTarget | null;
  token: LobbyToken | undefined;
  attendees: Attendee[];
  squads: Squad[];
  sending: boolean;
  sent: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function TokenProposeDialog({
  open,
  target,
  token,
  attendees,
  squads,
  sending,
  sent,
  error,
  onConfirm,
  onClose,
}: TokenProposeDialogProps) {
  if (!open || !target) {
    return null;
  }

  const dest = target.toSquadId
    ? squads.find((squad) => squad.id === target.toSquadId)?.name ?? "this squad"
    : attendees.find((person) => person.id === target.toBotId)?.name ?? "this bot";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-[#262626] bg-[#111] p-4">
        <p className="micro text-white/40">Propose token</p>
        <p className="mt-2 text-[13px] text-white/85">
          Share <span className="text-amber-300">{token?.taskLabel ?? "your current task"}</span> with{" "}
          {dest}?
        </p>
        <p className="mt-1 text-[11px] text-white/40">
          They have to approve before it shows on their card.
        </p>
        {error ? <p className="mt-2 text-[11px] text-red-300">{error}</p> : null}
        {sent ? (
          <p className="mt-3 text-[12px] text-emerald-300">Proposal sent — waiting on approval.</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {sent ? "Close" : "Cancel"}
          </Button>
          {!sent ? (
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground"
              disabled={sending || !token}
              onClick={onConfirm}
            >
              {sending ? "Sending…" : token ? "Send proposal" : "Sync a token first"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
