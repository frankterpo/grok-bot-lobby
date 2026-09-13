"use client";

import { Button } from "@/components/ui/button";
import type { Actor, Event, SquadInvite } from "@/lib/domain";
import { incomingInvitesFor, outgoingInvitesFor } from "@/lib/squad-invite-view";

type SquadInviteBannerProps = {
  invites: SquadInvite[];
  event: Event;
  actor: Actor;
  onRespond: (inviteId: string, status: "accepted" | "rejected") => Promise<void>;
};

function nameOf(event: Event, id: string): string {
  return event.attendees.find((person) => person.id === id)?.name ?? "A bot";
}

function squadName(event: Event, squadId: string): string {
  return event.squads.find((squad) => squad.id === squadId)?.name ?? "a group";
}

export function SquadInviteBanner({ invites, event, actor, onRespond }: SquadInviteBannerProps) {
  const incoming = incomingInvitesFor(invites, actor, event);
  const outgoing = outgoingInvitesFor(invites, actor).filter(
    (invite) => !incoming.some((item) => item.id === invite.id),
  );

  if (incoming.length === 0 && outgoing.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm space-y-2">
        {incoming.map((invite) => (
          <div
            key={invite.id}
            className="animate-in slide-in-from-top-2 fade-in rounded-lg border border-amber-400/40 bg-[#161616] px-3 py-2.5 shadow-lg shadow-black/40"
          >
            <p className="micro text-amber-300/80">
              {invite.direction === "invite" ? "Party invite" : "Join request"}
            </p>
            <p className="mt-1 text-[12px] text-white/85">
              {invite.direction === "invite"
                ? `${nameOf(event, invite.fromBotId)} invited you to ${squadName(event, invite.squadId)}`
                : `${nameOf(event, invite.fromBotId)} wants to join ${squadName(event, invite.squadId)}`}
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="xs"
                className="h-7 bg-amber-400 text-[#111] hover:bg-amber-300"
                onClick={() => void onRespond(invite.id, "accepted")}
              >
                Accept
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-7 border-[#262626]"
                onClick={() => void onRespond(invite.id, "rejected")}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
        {outgoing.map((invite) => (
          <div
            key={invite.id}
            className="rounded-md border border-[#262626] bg-[#111]/95 px-3 py-2 text-[11px] text-white/50"
          >
            Invite sent to {nameOf(event, invite.toBotId)} · {squadName(event, invite.squadId)}
          </div>
        ))}
      </div>
    </div>
  );
}
