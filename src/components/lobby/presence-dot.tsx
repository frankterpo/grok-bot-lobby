import { type PresenceState } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function PresenceDot({
  state,
  pulse = false,
}: {
  state: PresenceState;
  pulse?: boolean;
}) {
  const color =
    state === "active" ? "bg-emerald-400" : state === "stale" ? "bg-white/45" : "bg-white/25";
  return (
    <span className="relative inline-flex size-1.5 shrink-0" aria-hidden>
      {state === "active" && pulse ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
      ) : null}
      <span className={cn("relative size-1.5 rounded-full", color)} />
    </span>
  );
}
