"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { GrokBot } from "@/components/lobby/grok-bot";
import { BotCard } from "@/components/lobby/bot-card";
import { presenceState, type Attendee, type LobbyToken, type PresenceRecord, type Squad } from "@/lib/domain";
import { cn } from "@/lib/utils";

function isWorking(
  attendeeId: string,
  tokens: LobbyToken[],
  presence: PresenceRecord[],
  now: number,
): boolean {
  const record = presence.find((item) => item.userId === attendeeId);
  const state = record ? presenceState(record, now) : "offline";
  const token = tokens.find((item) => item.botId === attendeeId);
  return state === "active" && token?.status === "working";
}

type BotGridProps = {
  solo: Attendee[];
  squads: Squad[];
  tokens: LobbyToken[];
  presence: PresenceRecord[];
  selectedAttendeeId: string | null;
  selectedSquadId: string | null;
  panelCollapsed: boolean;
  now: number;
  onSelectAttendee: (id: string) => void;
  onSelectSquad: (id: string) => void;
};

export function BotGrid({
  solo,
  squads,
  tokens,
  presence,
  selectedAttendeeId,
  selectedSquadId,
  panelCollapsed,
  now,
  onSelectAttendee,
  onSelectSquad,
}: BotGridProps) {
  const [showAll, setShowAll] = useState(false);
  const limit = panelCollapsed ? 10 : 12;
  const visible = showAll ? solo : solo.slice(0, limit);
  const hidden = Math.max(0, solo.length - visible.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-4 md:px-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="micro text-white/40">Solo</h2>
          {hidden > 0 ? (
            <button
              type="button"
              className="micro flex items-center gap-1 text-white/40 hover:text-[#f59e0b]"
              onClick={() => setShowAll(true)}
            >
              See all <ArrowRight className="size-3" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        {solo.length === 0 ? (
          <p className="text-[12px] text-white/40">No bots in the room yet. Join via Grok Bot / join-lobby.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {visible.map((attendee) => (
              <BotCard
                key={attendee.id}
                attendee={attendee}
                token={tokens.find((item) => item.botId === attendee.id)}
                presence={presence.find((record) => record.userId === attendee.id)}
                selected={selectedAttendeeId === attendee.id}
                now={now}
                onSelect={() => onSelectAttendee(attendee.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="micro mb-3 text-white/40">Group</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {squads.map((squad) => (
            <button
              key={squad.id}
              type="button"
              onClick={() => onSelectSquad(squad.id)}
              className={cn(
                "rounded-lg border bg-[#161616] p-2 text-left",
                selectedSquadId === squad.id ? "border-[#f59e0b]" : "border-[#262626] hover:border-white/20",
              )}
            >
              <div className="grid grid-cols-2 gap-1">
                {squad.members.slice(0, 4).map((member) => (
                  <div key={member.id} className="grid place-items-center py-1">
                    <GrokBot
                      attendee={member}
                      size="sm"
                      showYou={member.isCurrentUser}
                      animated={isWorking(member.id, tokens, presence, now)}
                    />
                  </div>
                ))}
              </div>
              <p className="micro mt-2 text-white/45">
                {squad.name} · {squad.members.length}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
