export const RSVP_STATUSES = ["going", "waitlist", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const TOKEN_STATUSES = ["working", "done", "waiting", "idle"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

// Lobby task-token privacy (not grok-bot-skill transcript sharing).
// grok-bot-skill `transcript` returns full entry text with no privacy tiers — see internal/share-levels-audit.md.
export const SHARE_LEVELS = ["label", "label+status", "full"] as const;
export type ShareLevel = (typeof SHARE_LEVELS)[number];

export const IDENTITY_SLOTS = ["you", "attendee"] as const;
export type IdentitySlot = (typeof IDENTITY_SLOTS)[number];

export const SESSION_ROLES = ["host", "attendee", "guest"] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

export const PRESENCE_STATES = ["active", "stale", "offline"] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const BOT_VARIANTS = ["blob", "square", "cat", "owl", "antenna"] as const;
export type BotVariant = (typeof BOT_VARIANTS)[number];

export const BOT_COLORS = {
  coral: "#f97066",
  cyan: "#22d3ee",
  yellow: "#facc15",
  orange: "#fb923c",
  amber: "#f59e0b",
} as const;

export type BotColorName = keyof typeof BOT_COLORS;

export type User = {
  id: string;
  name: string;
  botAvatarUrl?: string;
  botColor?: string;
  lumaProfileUrl?: string;
  lumaHandle?: string;
  botTaskLabel?: string;
};

export type Attendee = User & {
  eventId: string;
  rsvpStatus: RsvpStatus;
  squadId?: string;
  isCurrentUser: boolean;
};

export type Squad = {
  id: string;
  eventId: string;
  name: string;
  organizerId: string;
  members: Attendee[];
  isOpen: boolean;
};

export type Event = {
  id: string;
  name: string;
  date: string;
  lumaEventId?: string;
  attendees: Attendee[];
  squads: Squad[];
  eventCode: string;
};

export type LumaPastEvent = {
  id: string;
  name: string;
  date: string;
  city?: string;
};

export type LumaProfile = {
  userId: string;
  bio?: string;
  twitter?: string;
  linkedin?: string;
  pastEvents: LumaPastEvent[];
};

export type LobbyToken = {
  botId: string;
  eventId: string;
  taskLabel: string;
  status: TokenStatus;
  focus?: string;
  timestamp: string;
  shareLevel: ShareLevel;
};

export const EXCHANGE_STATUSES = ["pending", "approved", "rejected"] as const;
export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

export type TokenExchangeRequest = {
  id: string;
  eventId: string;
  fromBotId: string;
  toBotId?: string;
  toSquadId?: string;
  token: LobbyToken;
  status: ExchangeStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type PresenceRecord = {
  userId: string;
  eventId: string;
  lastHeartbeat: string | null;
  claimed: boolean;
};

export type PresenceView = PresenceRecord & {
  state: PresenceState;
};

export type Actor = {
  slot: IdentitySlot;
  userId: string | null;
  role: SessionRole;
  hostAuthenticated?: boolean;
};

export type SessionView = {
  userId: string | null;
  role: SessionRole;
  slot: IdentitySlot;
  claimed: boolean;
  permissionsAccepted: boolean;
  shareLevel: ShareLevel;
  shareTokens: boolean;
  hasGrokBot: boolean;
};

export type ChecklistItemId =
  | "open-event"
  | "copy-code"
  | "second-join"
  | "claim-bot"
  | "both-appear"
  | "set-token"
  | "squad";

export type ChecklistItem = {
  id: ChecklistItemId;
  step: number;
  label: string;
  done: boolean;
};

export type LobbySnapshot = {
  event: Event | null;
  events: Event[];
  tokens: LobbyToken[];
  presence: PresenceView[];
  profiles: LumaProfile[];
  exchanges: TokenExchangeRequest[];
  session: SessionView;
  joinUrl: string | null;
  checklist: ChecklistItem[];
  activeBotCount: number;
  pendingApprovalCount: number;
};

export type BotContext = {
  attendee: Attendee;
  profile: LumaProfile | null;
  token: LobbyToken | null;
  presence: PresenceView;
  exchanges: TokenExchangeRequest[];
  receivedTokens: LobbyToken[];
};

export type Selection =
  | { kind: "you"; attendeeId: string }
  | { kind: "attendee"; attendeeId: string }
  | { kind: "squad"; squadId: string }
  | { kind: "none" };

export const HEARTBEAT_MS = 30_000;
export const STALE_AFTER_MS = 90_000;

export const HOST_USER_ID = "user_francisco";

export const CLAIM_COLORS = [
  BOT_COLORS.coral,
  BOT_COLORS.cyan,
  BOT_COLORS.yellow,
  BOT_COLORS.orange,
] as const;

export function assertNever(value: never, label: string): never {
  throw new Error(`unhandled ${label}: ${String(value)}`);
}

export function isRsvpStatus(value: string): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value);
}

export function isTokenStatus(value: string): value is TokenStatus {
  return (TOKEN_STATUSES as readonly string[]).includes(value);
}

export function isShareLevel(value: string): value is ShareLevel {
  return (SHARE_LEVELS as readonly string[]).includes(value);
}

export function isIdentitySlot(value: string): value is IdentitySlot {
  return (IDENTITY_SLOTS as readonly string[]).includes(value);
}

export function isExchangeStatus(value: string): value is ExchangeStatus {
  return (EXCHANGE_STATUSES as readonly string[]).includes(value);
}

export function parseBotColor(value: string): string | null {
  const trimmed = value.trim();
  const named = BOT_COLORS[trimmed.toLowerCase() as BotColorName];
  if (named) {
    return named;
  }
  const hex = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
  if (/^#[0-9a-f]{6}$/.test(hex)) {
    return hex;
  }
  return null;
}

export function isBotColor(value: string): boolean {
  return parseBotColor(value) !== null;
}

export function receivedTokensFor(
  exchanges: TokenExchangeRequest[],
  attendeeId: string,
  squadId?: string,
): LobbyToken[] {
  return exchanges
    .filter((item) => {
      if (item.status !== "approved") {
        return false;
      }
      if (item.toBotId === attendeeId) {
        return true;
      }
      return Boolean(squadId && item.toSquadId === squadId);
    })
    .map((item) => item.token);
}

export function tokenKey(eventId: string, botId: string): string {
  return `${eventId}:${botId}`;
}

export function presenceState(
  record: PresenceRecord,
  now = Date.now(),
): PresenceState {
  if (!record.claimed || record.lastHeartbeat === null) {
    return "offline";
  }
  const then = Date.parse(record.lastHeartbeat);
  if (Number.isNaN(then) || now - then > STALE_AFTER_MS) {
    return "stale";
  }
  return "active";
}

/**
 * Working animation gate — all must be true:
 * 1. Bot claimed with a recent heartbeat (`presenceState === "active"`, within STALE_AFTER_MS)
 * 2. Lobby token status is `"working"` (not idle/done/waiting)
 * 3. Offline, stale, and unclaimed demo seed bots fail #1 automatically
 *
 * Token `timestamp` is intentionally not checked: join-lobby syncs status once and
 * heartbeats keep presence live for long-running tasks.
 */
export function isBotWorking(
  presence: PresenceRecord | undefined,
  token: LobbyToken | undefined,
  now = Date.now(),
): boolean {
  if (!presence || !token || token.status !== "working") {
    return false;
  }
  return presenceState(presence, now) === "active";
}

export function presenceCopy(state: PresenceState): string {
  switch (state) {
    case "active":
      return "live";
    case "stale":
      return "no activity";
    case "offline":
      return "bot not active";
    default:
      return assertNever(state, "presence");
  }
}

export function tokenStatusCopy(status: TokenStatus): string {
  switch (status) {
    case "working":
      return "working";
    case "done":
      return "done";
    case "waiting":
      return "waiting";
    case "idle":
      return "idle";
    default:
      return assertNever(status, "token status");
  }
}

export function shareLevelCopy(level: ShareLevel): string {
  switch (level) {
    case "label":
      return "Task label only";
    case "label+status":
      return "Task + status";
    case "full":
      return "Task + status + focus";
    default:
      return assertNever(level, "share level");
  }
}

/** What others see at each share level (lobby tokens only — never transcript/workspace). */
export function shareLevelDescription(level: ShareLevel): string {
  switch (level) {
    case "label":
      return "Others see only your task name. No status, focus, or transcript.";
    case "label+status":
      return "Others see your task name and status (working, done, waiting, or idle).";
    case "full":
      return "Others also see your focus line from sync. Still no transcript or Agent Computer.";
    default:
      return assertNever(level, "share level");
  }
}

export function variantFor(userId: string): BotVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return BOT_VARIANTS[hash % BOT_VARIANTS.length];
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

/** 8-char crypto-random code (~32^8 combinations). Avoids ambiguous 0/O and 1/I. */
export function createEventCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
