import { GrokBotMark } from "@/components/lobby/grok-bot-mark";
import { BOT_COLORS } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Triangle layout from Grok Bot.app `Zne` (3-disc cluster). */
const CLUSTER_COLORS = [BOT_COLORS.cyan, "#7BAFE9", "#a78bfa"] as const;

type Disc = { x: number; y: number; size: number };

function triangleLayout(frame: number, count: number): Disc[] {
  if (count <= 1) {
    return [{ x: 0, y: 0, size: frame }];
  }
  if (count === 2) {
    const r = (frame * 2) / 3;
    const offset = frame - r;
    return [{ x: 0, y: 0, size: r }, { x: offset, y: offset, size: r }];
  }
  const disc = (frame * 5) / 9;
  const gap = frame - disc;
  if (count === 3) {
    return [
      { x: gap / 2, y: 0, size: disc },
      { x: 0, y: gap, size: disc },
      { x: gap, y: gap, size: disc },
    ];
  }
  return [
    { x: 0, y: 0, size: disc },
    { x: gap, y: 0, size: disc },
    { x: 0, y: gap, size: disc },
    { x: gap, y: gap, size: disc },
  ];
}

type GroupClusterAvatarProps = {
  colors?: string[];
  size?: number;
  animated?: boolean;
  className?: string;
};

export function GroupClusterAvatar({
  colors,
  size = 44,
  animated = false,
  className,
}: GroupClusterAvatarProps) {
  const palette = colors?.length ? colors : [...CLUSTER_COLORS];
  const discs = triangleLayout(size, Math.min(3, palette.length));
  const marks = discs.map((disc, index) => ({
    disc,
    color: palette[index % palette.length] ?? CLUSTER_COLORS[index % CLUSTER_COLORS.length],
  }));

  return (
    <span
      aria-hidden
      className={cn("group-cluster-avatar relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {marks.map(({ disc, color }, index) => (
        <span
          key={index}
          className="absolute"
          style={{
            left: disc.x,
            top: disc.y,
            width: disc.size,
            height: disc.size,
            zIndex: index + 1,
          }}
        >
          <GrokBotMark
            color={color}
            size={disc.size}
            animated={animated}
            restSeed={`${color}-${index}`}
          />
        </span>
      ))}
    </span>
  );
}
