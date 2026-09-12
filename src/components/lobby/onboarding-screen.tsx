"use client";

import { CHECKLIST_COPY, type ChecklistItem } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OnboardingScreenProps = {
  items: ChecklistItem[];
  onOpenLobby: () => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function OnboardingScreen({ items, onOpenLobby, onCreate, onJoin }: OnboardingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
      <div className="w-full max-w-md rounded-lg border border-[#262626] bg-[#111] p-5">
        <p className="micro text-white/45">Host display</p>
        <h1 className="mt-2 text-[16px] font-medium text-white/90">Grok Bot Lobby</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-white/50">
          Attendees join through Grok Bot. Create an event first — you get a unique code and join URL. Tell guests:
          Join lobby CODE at the URL.
        </p>
        <ol className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2 text-[12px]">
              <span
                className={cn(
                  "mt-0.5 grid size-4 place-items-center rounded-sm border text-[9px]",
                  item.done ? "border-white/40 text-white/70" : "border-[#262626] text-white/30",
                )}
              >
                {item.step}
              </span>
              <span className={item.done ? "text-white/45 line-through" : "text-white/70"}>{item.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onCreate}
          >
            Create event
          </Button>
          <Button type="button" variant="outline" className="border-[#262626]" onClick={onOpenLobby}>
            Open lobby
          </Button>
          <button type="button" className="text-[11px] text-white/35 underline-offset-2 hover:underline" onClick={onJoin}>
            Mirror / fallback join
          </button>
        </div>
      </div>
    </div>
  );
}

export function outstandingTasksRemaining(items: ChecklistItem[]): number {
  return items.filter((item) => !item.done).length;
}

export function OutstandingTasksList({ items }: { items: ChecklistItem[] }) {
  return (
    <ol className="max-h-48 space-y-1.5 overflow-y-auto">
      {CHECKLIST_COPY.map((item, index) => {
        const live = items[index];
        const done = live?.done ?? false;
        return (
          <li key={item.id} className="flex gap-2 text-[11px]">
            <span
              className={cn(
                "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-sm border text-[8px]",
                done ? "border-white/40 text-white/70" : "border-[#262626] text-white/25",
              )}
            >
              {done ? "✓" : live?.step ?? index + 1}
            </span>
            <span className={done ? "text-white/35 line-through" : "text-white/55"}>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
