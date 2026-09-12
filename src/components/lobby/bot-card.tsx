import {
  HEARTBEAT_MS,
  presenceCopy,
  presenceState,
  tokenStatusCopy,
  type Attendee,
  type LobbyToken,
  type PresenceRecord,
} from "@/lib/domain";
import { GrokBot } from "@/components/lobby/grok-bot";
import { cn } from "@/lib/utils";

type BotCardProps = {
  attendee: Attendee;
  token: LobbyToken | undefined;
  received: LobbyToken[];
  presence: PresenceRecord | undefined;
  selected: boolean;
  now: number;
  onSelect: () => void;
};

export function BotCard({
  attendee,
  token,
  received,
  presence,
  selected,
  now,
  onSelect,
}: BotCardProps) {
  const state = presence ? presenceState(presence, now) : "offline";
  const strip =
    state === "offline"
      ? presenceCopy(state)
      : state === "stale"
        ? presenceCopy(state)
        : token
          ? `${token.taskLabel}${token.shareLevel === "label" ? "" : ` · ${tokenStatusCopy(token.status)}`}`
          : presenceCopy(state);
  const openForSquad = !attendee.squadId;
  const approved = received[0];

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
      <GrokBot attendee={attendee} size="lg" showYou={attendee.isCurrentUser} />
      <span className="max-w-[72px] truncate text-[11px] text-white/80">{attendee.name}</span>
      <span className="micro max-w-[88px] truncate text-white/35">{strip}</span>
      {approved ? (
        <span className="micro max-w-[88px] truncate text-[#f59e0b]/80">in: {approved.taskLabel}</span>
      ) : null}
      {openForSquad ? <span className="micro text-white/30">open for squad</span> : null}
    </button>
  );
}

export { HEARTBEAT_MS };
