"use client";

import { CHECKLIST_COPY, type ChecklistItem } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OnboardingScreenProps = {
  items: ChecklistItem[];
  onOpenSeed: () => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function OnboardingScreen({ items, onOpenSeed, onCreate, onJoin }: OnboardingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
      <div className="w-full max-w-md rounded-lg border border-[#262626] bg-[#111] p-5">
        <p className="micro text-[#f59e0b]">Host display</p>
        <h1 className="mt-2 text-[16px] font-medium text-white/90">Grok Bot Lobby</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-white/50">
          Attendees join through Grok Bot. This screen is the shared grid you project. Tell them: Join lobby COLOOP
          at the URL.
        </p>
        <ol className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2 text-[12px]">
              <span
                className={cn(
                  "mt-0.5 grid size-4 place-items-center rounded-sm border text-[9px]",
                  item.done ? "border-[#f59e0b] text-[#f59e0b]" : "border-[#262626] text-white/30",
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
            className="bg-[#f59e0b] text-[#0d0d0d] hover:bg-[#f59e0b]/90"
            onClick={onOpenSeed}
          >
            Open host lobby
          </Button>
          <Button type="button" variant="outline" className="border-[#262626]" onClick={onCreate}>
            Create event
          </Button>
          <button type="button" className="text-[11px] text-white/35 underline-offset-2 hover:underline" onClick={onJoin}>
            Mirror / fallback join
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChecklistDock({ items }: { items: ChecklistItem[] }) {
  const remaining = items.filter((item) => !item.done).length;
  return (
    <details className="absolute bottom-3 left-[212px] z-20 hidden w-72 rounded-lg border border-[#262626] bg-[#111] md:block">
      <summary className="micro cursor-pointer px-3 py-2 text-white/40">
        {remaining === 0 ? "Lobby ready" : `${remaining} Grok Bot steps left`}
      </summary>
      <ol className="space-y-1.5 border-t border-[#262626] px-3 py-2">
        {CHECKLIST_COPY.map((item, index) => {
          const live = items[index];
          return (
            <li key={item.id} className="flex gap-2 text-[11px] text-white/55">
              <span className={live?.done ? "text-[#f59e0b]" : "text-white/30"}>{item.label}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
