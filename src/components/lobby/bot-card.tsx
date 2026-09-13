import { GrokBot } from "@/components/lobby/grok-bot";
import { PresenceDot } from "@/components/lobby/presence-dot";
import { isBotWorking, presenceState, type Attendee, type LobbyToken, type PresenceRecord } from "@/lib/domain";
import { cn } from "@/lib/utils";

type BotCardProps = {
  attendee: Attendee;
  token: LobbyToken | undefined;
  presence: PresenceRecord | undefined;
  selected: boolean;
  now: number;
  onSelect: () => void;
};

export function BotCard({ attendee, token, presence, selected, now, onSelect }: BotCardProps) {
  const state = presence ? presenceState(presence, now) : "offline";
  const animated = isBotWorking(presence, token, now);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex h-full min-h-[100px] w-full max-w-[140px] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-colors",
        selected
          ? "border-white/25 bg-[#161616]"
          : "border-transparent hover:border-[#262626] hover:bg-[#161616]",
      )}
    >
      <div className="flex w-[min(100%,56px)] shrink-0 items-center justify-center">
        <GrokBot attendee={attendee} size="lg" animated={animated} youRing={attendee.isCurrentUser} />
      </div>
      <div className="flex w-full min-w-0 items-center justify-center gap-1 px-0.5">
        <PresenceDot state={state} pulse={attendee.isCurrentUser && state === "active"} />
        <span className="truncate text-[11px] text-white/80">
          {attendee.isCurrentUser ? `${attendee.name}` : attendee.name}
        </span>
      </div>
    </button>
  );
}
