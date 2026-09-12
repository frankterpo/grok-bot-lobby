"use client";

import { Plus } from "lucide-react";

import { EventCodeChip } from "@/components/lobby/event-code-chip";
import { Button } from "@/components/ui/button";
import type { Actor, Attendee, Event } from "@/lib/domain";
import { formatEventDate, initialsForName } from "@/lib/format";
import { canCreateEvent, canShareEvent } from "@/lib/policy";
import { cn } from "@/lib/utils";

type LobbySidebarProps = {
  events: Event[];
  activeEventId: string | null;
  joinUrl: string | null;
  actor: Actor;
  currentAttendee: Attendee | null;
  onSelect: (eventId: string) => void;
  onCreate: () => void;
  onProfileClick?: () => void;
};

export function LobbySidebar({
  events,
  activeEventId,
  joinUrl,
  actor,
  currentAttendee,
  onSelect,
  onCreate,
  onProfileClick,
}: LobbySidebarProps) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#262626] bg-[#111]">
      <div className="flex items-center justify-between px-3 py-3">
        <p className="micro text-white/40">Lobby</p>
        {canCreateEvent(actor) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-white/50 hover:text-[#f59e0b]"
            onClick={onCreate}
            aria-label="Create event"
          >
            <Plus strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
        {events.map((event) => {
          const active = event.id === activeEventId;
          return (
            <div
              key={event.id}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left",
                active ? "border-[#262626] bg-[#161616]" : "border-transparent hover:bg-[#161616]",
              )}
            >
              <button type="button" className="w-full text-left" onClick={() => onSelect(event.id)}>
                <p className={cn("text-[12px] font-medium", active ? "text-[#f59e0b]" : "text-white/85")}>
                  {event.name}
                </p>
                <p className="micro mt-0.5 text-white/35">{formatEventDate(event.date)}</p>
              </button>
              {active && joinUrl && canShareEvent(actor) ? (
                <EventCodeChip code={event.eventCode} eventId={event.id} joinUrl={joinUrl} />
              ) : (
                <p className="micro mt-1 text-white/30">{event.eventCode}</p>
              )}
            </div>
          );
        })}
      </nav>
      {currentAttendee && actor.userId ? (
        <button
          type="button"
          onClick={onProfileClick}
          className="flex shrink-0 items-center gap-2 border-t border-[#262626] px-3 py-2.5 text-left transition-colors hover:bg-[#161616]"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#262626] text-[10px] font-medium tracking-wide text-white/70">
            {initialsForName(currentAttendee.name)}
          </span>
          <span className="min-w-0 truncate text-[12px] text-white/85">{currentAttendee.name}</span>
        </button>
      ) : null}
    </aside>
  );
}
