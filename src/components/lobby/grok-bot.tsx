import { GrokBotMark } from "@/components/lobby/grok-bot-mark";
import { type Attendee } from "@/lib/domain";
import { cn } from "@/lib/utils";

type GrokBotProps = {
  attendee: Attendee;
  size?: "sm" | "md" | "lg";
  /** @deprecated Prefer youLabel / youRing */
  showYou?: boolean;
  youLabel?: boolean;
  youRing?: boolean;
  animated?: boolean;
};

export function GrokBot({
  attendee,
  size = "md",
  showYou = false,
  youLabel,
  youRing,
  animated = false,
}: GrokBotProps) {
  const px = size === "lg" ? 56 : size === "sm" ? 28 : 44;
  const color = attendee.botColor ?? "#f97066";
  const isYou = showYou || attendee.isCurrentUser;
  const showLabel = youLabel ?? (showYou || attendee.isCurrentUser);
  const showRing = youRing ?? (showYou || attendee.isCurrentUser);
  const photo = attendee.botAvatarUrl;

  return (
    <div className="relative inline-flex items-center justify-center">
      {isYou && showLabel ? (
        <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 text-[8px] font-medium tracking-[0.08em] text-[#f59e0b]/65 uppercase">
          you
        </span>
      ) : null}
      <div
        className={cn(
          "relative",
          photo ? "overflow-hidden rounded-full" : "",
          isYou && showRing
            ? "rounded-full ring-1 ring-[#f59e0b]/55 ring-offset-1 ring-offset-[#0d0d0d]"
            : "",
        )}
        style={{ width: px, height: px }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={attendee.name} className="size-full object-cover" />
        ) : (
          <GrokBotMark color={color} size={px} animated={animated} />
        )}
      </div>
      {photo ? <GrokBadge size={size === "sm" ? 10 : 14} /> : null}
    </div>
  );
}

export function GrokBadge({ size = 14 }: { size?: number }) {
  return (
    <span
      className="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-sm bg-[#111] ring-1 ring-[#262626]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 12 12" width={size - 3} height={size - 3} aria-hidden>
        <path
          d="M6 1.5 7.2 4.8 10.7 6 7.2 7.2 6 10.5 4.8 7.2 1.3 6 4.8 4.8Z"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
