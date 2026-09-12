"use client";

import { useMemo, useState } from "react";
import { Inbox, Plus, Search } from "lucide-react";

import { EventCodeChip } from "@/components/lobby/event-code-chip";
import { GrokBotMark } from "@/components/lobby/grok-bot-mark";
import {
  OutstandingTasksList,
  outstandingTasksRemaining,
} from "@/components/lobby/onboarding-screen";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Actor, Attendee, ChecklistItem, Event } from "@/lib/domain";
import { formatEventDate } from "@/lib/format";
import { canCreateEvent, canShareEvent } from "@/lib/policy";
import { cn } from "@/lib/utils";

type LobbySidebarProps = {
  events: Event[];
  activeEventId: string | null;
  joinUrl: string | null;
  actor: Actor;
  currentAttendee: Attendee | null;
  checklistItems: ChecklistItem[];
  activeBotCount: number;
  pendingApprovalCount: number;
  profileAnimated?: boolean;
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
  checklistItems,
  activeBotCount,
  pendingApprovalCount,
  profileAnimated = false,
  onSelect,
  onCreate,
  onProfileClick,
}: LobbySidebarProps) {
  const [query, setQuery] = useState("");
  const remainingTasks = outstandingTasksRemaining(checklistItems);
  const adminAttentionCount = remainingTasks + pendingApprovalCount;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return events;
    }
    return events.filter(
      (event) =>
        event.name.toLowerCase().includes(needle) ||
        event.eventCode.toLowerCase().includes(needle),
    );
  }, [events, query]);

  const showFooter = Boolean(currentAttendee && actor.userId) || checklistItems.length > 0;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-3 py-3">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/30"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events"
            className="h-8 w-full rounded-md border border-[#262626] bg-[#0d0d0d] pr-2 pl-8 text-[12px] text-white/80 placeholder:text-white/30 outline-none transition-colors focus:border-white/25 focus:ring-1 focus:ring-white/15"
          />
        </label>
        {canCreateEvent(actor) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-8 shrink-0 text-white/50 hover:bg-sidebar-accent hover:text-sidebar-primary"
            onClick={onCreate}
            aria-label="Create event"
          >
            <Plus strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-white/35">No events match.</p>
        ) : (
          filtered.map((event) => {
            const active = event.id === activeEventId;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelect(event.id)}
                className={cn(
                  "lobby-event-row w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-transparent bg-[var(--grok-sidebar-selected)]"
                    : "border-transparent hover:bg-[var(--grok-sidebar-hover)]",
                )}
              >
                <p
                  className={cn(
                    "truncate text-[12px] font-medium",
                    active ? "text-white/90" : "text-white/85",
                  )}
                >
                  {event.name}
                </p>
                <p className="micro mt-0.5 text-white/35">{formatEventDate(event.date)}</p>
                {active && joinUrl && canShareEvent(actor) ? (
                  <div className="mt-1.5">
                    <EventCodeChip code={event.eventCode} eventId={event.id} joinUrl={joinUrl} />
                  </div>
                ) : (
                  <p className="micro mt-1 text-white/30">{event.eventCode}</p>
                )}
              </button>
            );
          })
        )}
      </nav>

      {showFooter ? (
        <div className="flex shrink-0 items-stretch border-t border-sidebar-border">
          {currentAttendee && actor.userId ? (
            <button
              type="button"
              onClick={onProfileClick}
              className="lobby-event-row flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
            >
              <GrokBotMark
                color={currentAttendee.botColor ?? "#f97066"}
                size={28}
                animated={profileAnimated}
                restSeed={currentAttendee.id}
              />
              <span className="min-w-0 truncate text-[12px] text-white/85">{currentAttendee.name}</span>
            </button>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="relative flex shrink-0 items-center justify-center px-3 py-2.5 text-white/45 transition-colors hover:bg-sidebar-accent hover:text-white/70"
                  aria-label={
                    adminAttentionCount > 0
                      ? `Admin tasks, ${adminAttentionCount} remaining`
                      : "Admin tasks"
                  }
                />
              }
            >
              <Inbox className="size-4" strokeWidth={1.5} />
              {adminAttentionCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 grid min-w-[14px] place-items-center rounded-full bg-white/80 px-1 text-[9px] font-medium leading-none text-[#0d0d0d]">
                  {adminAttentionCount}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={4}
              className="w-[260px] border-[#262626] bg-[#111] p-3 text-white/80 shadow-lg ring-[#262626]"
            >
              <p className="micro mb-2 text-white/40">Admin tasks</p>
              <p className="mb-3 text-[11px] text-white/55">
                {activeBotCount} active · {pendingApprovalCount} pending approvals
              </p>
              {checklistItems.length > 0 ? (
                <>
                  <p className="micro mb-1.5 text-white/35">Onboarding</p>
                  <OutstandingTasksList items={checklistItems} />
                </>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </aside>
  );
}
