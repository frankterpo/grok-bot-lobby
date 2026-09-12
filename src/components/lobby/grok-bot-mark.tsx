import { useId, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Official Grok Bot mark geometry from Grok Bot.app renderer bundle. */
export const GROK_BOT_MARK_VIEWBOX = "-15 -15 259 259";

export const GROK_BOT_MARK_HEAD =
  "M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z";

export const GROK_BOT_MARK_LEFT_EYE =
  "M130.36 45.98L132.71 46.19L134.98 46.81L137.11 47.83L138.97 49.28L140.47 51.09L141.68 53.12L142.73 55.23L143.76 57.36L144.78 59.49L145.79 61.62L146.79 63.76L147.76 65.91L148.71 68.07L149.63 70.25L150.52 72.43L151.37 74.63L151.99 76.91L152.1 79.26L151.64 81.57L150.59 83.68L149.04 85.45L147.1 86.78L144.9 87.62L142.56 87.93L140.22 87.71L137.98 86.99L135.93 85.82L134.17 84.24L132.78 82.34L131.69 80.25L130.77 78.08L129.87 75.89L128.94 73.72L128 71.56L127.03 69.4L126.05 67.26L125.05 65.12L124.03 62.99L122.93 60.9L121.87 58.79L121.03 56.59L120.72 54.26L121.1 51.93L122.15 49.83L123.75 48.1L125.76 46.89L128.01 46.19Z";

export const GROK_BOT_MARK_RIGHT_EYE =
  "M176.61 37.08L178.72 37.59L180.7 38.48L182.52 39.65L184.2 41.03L185.71 42.59L187.03 44.31L188.2 46.14L189.26 48.03L190.27 49.96L191.26 51.89L192.23 53.84L193.16 55.8L194.05 57.78L194.92 59.77L195.74 61.78L196.53 63.8L197.27 65.84L197.97 67.9L198.47 70.01L198.63 72.18L198.4 74.33L197.58 76.33L195.95 77.72L193.83 78.08L191.71 77.65L189.76 76.69L188.03 75.38L186.53 73.82L185.28 72.05L184.25 70.13L183.4 68.14L182.63 66.11L181.87 64.07L181.07 62.05L180.25 60.04L179.39 58.05L178.49 56.07L177.57 54.1L176.61 52.15L175.62 50.22L174.59 48.31L173.53 46.41L172.54 44.48L171.86 42.42L171.76 40.26L172.62 38.3L174.45 37.19Z";

const EYE_FILL = "#141414";

/** Head centroid — belt orbits this point. */
const BELT_CX = 114.5;
const BELT_CY = 114.5;
/** Orbit inset from head edge — arcs hug the blob perimeter without crossing the face. */
const BELT_RX = 92;
const BELT_RY = 88;
const BELT_ARC_SWEEP = 70;

/** x.ai working trails: hsl(H 56% L%) stops along each band gradient. */
const ORBIT_BANDS = [
  { hue: 214, startDeg: 0, delayMs: 0 },
  { hue: 297, startDeg: 90, delayMs: 600 },
  { hue: 13, startDeg: 180, delayMs: 1200 },
  { hue: 106, startDeg: 270, delayMs: 1800 },
] as const;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Elliptical arc segment for one rainbow belt band. */
function beltArcPath(cx: number, cy: number, rx: number, ry: number, startDeg: number, sweepDeg: number): string {
  const start = degToRad(startDeg);
  const end = degToRad(startDeg + sweepDeg);
  const x1 = cx + rx * Math.cos(start);
  const y1 = cy + ry * Math.sin(start);
  const x2 = cx + rx * Math.cos(end);
  const y2 = cy + ry * Math.sin(end);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx} ${ry} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function beltGradientEndpoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startDeg: number,
  sweepDeg: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const start = degToRad(startDeg);
  const end = degToRad(startDeg + sweepDeg);
  return {
    x1: cx + rx * Math.cos(start),
    y1: cy + ry * Math.sin(start),
    x2: cx + rx * Math.cos(end),
    y2: cy + ry * Math.sin(end),
  };
}

/** Spread idle phase across bots so a grid does not pulse in sync. */
function restAnimationDelayMs(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 12000;
}

/** Match cluster-disc perceived motion: compact ≈24–32px, scale down for larger marks. */
function restSizeClass(size: number): string | false {
  if (size >= 48) {
    return "grok-bot-mark--rest-large";
  }
  if (size >= 36) {
    return "grok-bot-mark--rest-medium";
  }
  return "grok-bot-mark--rest-compact";
}

type GrokBotMarkProps = {
  color: string;
  size?: number;
  fill?: boolean;
  animated?: boolean;
  /** Stable id (e.g. attendee id) for desynced idle phase; defaults to color. */
  restSeed?: string;
  className?: string;
};

export function GrokBotMark({
  color,
  size = 44,
  fill = true,
  animated = false,
  restSeed,
  className,
}: GrokBotMarkProps) {
  const clipId = useId().replace(/:/g, "");

  return (
    <span
      aria-hidden
      className={cn(
        "grok-bot-lazy inline-block shrink-0 leading-none",
        fill && "grok-bot-mark--fill",
        animated && "grok-bot-mark--working",
        restSizeClass(size),
        className,
      )}
      style={
        {
          width: size,
          height: size,
          "--fg": color,
          "--bg": EYE_FILL,
          "--grok-bot-rest-delay": `${restAnimationDelayMs(restSeed ?? color)}ms`,
        } as CSSProperties
      }
    >
      <svg
        viewBox={GROK_BOT_MARK_VIEWBOX}
        className="block size-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {animated
            ? ORBIT_BANDS.map((band, index) => {
                const grad = beltGradientEndpoints(BELT_CX, BELT_CY, BELT_RX, BELT_RY, 0, BELT_ARC_SWEEP);
                return (
                  <linearGradient
                    key={band.hue}
                    id={`${clipId}-belt-${index}`}
                    gradientUnits="userSpaceOnUse"
                    x1={grad.x1}
                    y1={grad.y1}
                    x2={grad.x2}
                    y2={grad.y2}
                  >
                    {[0, 0.25, 0.5, 0.75, 1].map((offset, stopIndex) => {
                      const hue = (band.hue + stopIndex * 14) % 360;
                      const lightness = 56 + stopIndex * 3;
                      return (
                        <stop
                          key={offset}
                          offset={offset.toFixed(3)}
                          stopColor={`hsl(${hue} 56% ${lightness}%)`}
                        />
                      );
                    })}
                  </linearGradient>
                );
              })
            : null}
        </defs>
        <path className="grok-bot-mark__head" d={GROK_BOT_MARK_HEAD} fill="var(--fg)" />
        <g className="grok-bot-mark__eyes">
          <path className="grok-bot-mark__eye grok-bot-mark__eye--left" d={GROK_BOT_MARK_LEFT_EYE} fill="var(--bg)" />
          <path
            className="grok-bot-mark__eye grok-bot-mark__eye--right"
            d={GROK_BOT_MARK_RIGHT_EYE}
            fill="var(--bg)"
          />
        </g>
        {animated ? (
          <g className="grok-bot-mark__belts" aria-hidden>
            {ORBIT_BANDS.map((band, index) => (
              <g
                key={band.hue}
                className="grok-bot-mark__belt-orbit"
                style={
                  {
                    "--grok-bot-belt-start": `${band.startDeg}deg`,
                    "--grok-bot-belt-delay": `${band.delayMs}ms`,
                  } as CSSProperties
                }
              >
                <path
                  className="grok-bot-mark__belt-arc"
                  d={beltArcPath(BELT_CX, BELT_CY, BELT_RX, BELT_RY, 0, BELT_ARC_SWEEP)}
                  fill="none"
                  stroke={`url(#${clipId}-belt-${index})`}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
              </g>
            ))}
          </g>
        ) : null}
      </svg>
    </span>
  );
}
