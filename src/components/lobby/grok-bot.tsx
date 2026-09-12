import {
  assertNever,
  variantFor,
  type Attendee,
  type BotVariant,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

type GrokBotProps = {
  attendee: Attendee;
  size?: "sm" | "md" | "lg";
  showYou?: boolean;
};

export function GrokBot({ attendee, size = "md", showYou = false }: GrokBotProps) {
  const px = size === "lg" ? 56 : size === "sm" ? 28 : 44;
  const color = attendee.botColor ?? "#f97066";
  const variant = variantFor(attendee.id);
  const isYou = showYou || attendee.isCurrentUser;
  const photo = attendee.botAvatarUrl;

  return (
    <div className="relative inline-flex items-center justify-center">
      {isYou ? (
        <span className="micro absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-sm bg-[#0d0d0d] px-1 text-[#f59e0b]">
          YOU
        </span>
      ) : null}
      <div
        className={cn(
          "relative overflow-hidden rounded-full",
          isYou ? "ring-[1.5px] ring-[#f59e0b] ring-offset-2 ring-offset-[#0d0d0d]" : "",
        )}
        style={{ width: px, height: px }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={attendee.name} className="size-full object-cover" />
        ) : (
          <BotFace variant={variant} color={color} />
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

function BotFace({ variant, color }: { variant: BotVariant; color: string }) {
  const common = {
    fill: color,
    fillOpacity: 0.18,
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (variant) {
    case "blob":
      return (
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <rect width="64" height="64" fill="#111" />
          <path d="M20 18c0-6 5-10 12-10s12 4 12 10c7 2 10 8 10 16 0 12-8 22-22 22S10 46 10 34c0-8 3-14 10-16Z" {...common} />
          <circle cx="26" cy="32" r="2.2" fill={color} />
          <circle cx="38" cy="32" r="2.2" fill={color} />
          <path d="M28 40c2.4 2.4 5.6 2.4 8 0" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <rect width="64" height="64" fill="#111" />
          <rect x="12" y="16" width="40" height="36" rx="8" {...common} />
          <rect x="28" y="10" width="8" height="8" rx="2" {...common} />
          <circle cx="26" cy="34" r="2.2" fill={color} />
          <circle cx="38" cy="34" r="2.2" fill={color} />
          <path d="M26 44h12" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "cat":
      return (
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <rect width="64" height="64" fill="#111" />
          <path d="M18 26 26 14l6 10 6-10 8 12c6 4 8 10 8 16 0 12-10 20-22 20S10 54 10 42c0-6 2-12 8-16Z" {...common} />
          <circle cx="26" cy="36" r="2.2" fill={color} />
          <circle cx="38" cy="36" r="2.2" fill={color} />
          <path d="M22 38h-6M42 38h6" fill="none" stroke={color} strokeWidth="1.5" />
          <path d="M32 40v4M28 46c2.5 2 5.5 2 8 0" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "owl":
      return (
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <rect width="64" height="64" fill="#111" />
          <ellipse cx="32" cy="36" rx="20" ry="18" {...common} />
          <circle cx="24" cy="34" r="7" fill="none" stroke={color} strokeWidth="1.5" />
          <circle cx="40" cy="34" r="7" fill="none" stroke={color} strokeWidth="1.5" />
          <circle cx="24" cy="34" r="2" fill={color} />
          <circle cx="40" cy="34" r="2" fill={color} />
          <path d="M30 42h4l-2 4Z" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "antenna":
      return (
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <rect width="64" height="64" fill="#111" />
          <circle cx="32" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
          <path d="M32 15v8" fill="none" stroke={color} strokeWidth="1.5" />
          <circle cx="32" cy="38" r="18" {...common} />
          <circle cx="26" cy="36" r="2.2" fill={color} />
          <circle cx="38" cy="36" r="2.2" fill={color} />
          <path d="M26 46c3 2 9 2 12 0" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    default:
      return assertNever(variant, "bot variant");
  }
}
