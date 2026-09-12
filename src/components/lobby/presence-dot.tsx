import { type PresenceState } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function PresenceDot({ state }: { state: PresenceState }) {
  const color =
    state === "active" ? "bg-emerald-400" : state === "stale" ? "bg-[#f59e0b]" : "bg-white/25";
  return <span className={cn("size-1.5 shrink-0 rounded-full", color)} aria-hidden />;
}
