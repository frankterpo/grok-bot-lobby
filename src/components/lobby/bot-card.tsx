import { GrokBot } from "@/components/lobby/grok-bot";
import { presenceState, type Attendee, type LobbyToken, type PresenceRecord } from "@/lib/domain";
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
  const animated = state === "active" && token?.status === "working";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-lg border p-2 text-center transition-colors",
        selected
          ? "border-[#f59e0b] bg-[#161616]"
          : "border-transparent hover:border-[#262626] hover:bg-[#161616]",
      )}
    >
      <GrokBot attendee={attendee} size="lg" showYou={attendee.isCurrentUser} animated={animated} />
      <span className="max-w-[72px] truncate text-[11px] text-white/80">{attendee.name}</span>
    </button>
  );
}
