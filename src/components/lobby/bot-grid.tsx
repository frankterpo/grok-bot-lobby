"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { BotCard } from "@/components/lobby/bot-card";
import { GroupClusterAvatar } from "@/components/lobby/group-cluster-avatar";
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
          <div className="grid auto-rows-fr grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 [&>*]:min-w-0">
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
          {squads.map((squad) => {
            const isYourSquad = squad.members.some((member) => member.isCurrentUser);
            const squadSelected =
              selectedSquadId === squad.id ||
              (selectedAttendeeId !== null &&
                squad.members.some((member) => member.id === selectedAttendeeId));
            const clusterColors = squad.members.slice(0, 3).map((member) => member.botColor ?? "#f97066");
            const clusterAnimated = squad.members.some((member) =>
              isWorking(member.id, tokens, presence, now),
            );

            return (
              <button
                key={squad.id}
                type="button"
                onClick={() => onSelectSquad(squad.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border bg-[#161616] p-3 text-center transition-colors",
                  squadSelected ? "border-[#f59e0b]" : "border-[#262626] hover:border-white/20",
                )}
              >
                <GroupClusterAvatar
                  colors={clusterColors}
                  size={44}
                  animated={clusterAnimated}
                />
                <p className="micro text-white/45">
                  {isYourSquad ? (
                    <>
                      <span className="text-[#f59e0b]/70">YOU</span>
                      <span className="text-white/30"> · </span>
                    </>
                  ) : null}
                  {squad.name} · {squad.members.length}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
