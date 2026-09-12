import {
  canClaimBot,
  canCreateEvent,
  canHeartbeat,
  canInviteToSquad,
  canLeaveSquad,
  canProposeExchange,
  canRequestJoin,
  canResolveExchange,
  canShareEvent,
  canSyncToken,
  canViewFullToken,
  roleForEvent,
} from "@/lib/policy";
import {
  type Actor,
  type Attendee,
  type BotContext,
  type Event,
  type ExchangeStatus,
  type IdentitySlot,
  type LobbySnapshot,
  type LobbyToken,
  type LumaProfile,
  type PresenceRecord,
  type SessionView,
  type ShareLevel,
  type Squad,
  type TokenExchangeRequest,
  type TokenStatus,
  BOT_COLORS,
  HOST_USER_ID,
  SEED_EVENT_ID,
  assertNever,
  createEventCode,
  createId,
  presenceState,
  receivedTokensFor,
  tokenKey,
} from "@/lib/domain";
import { joinUrl } from "@/lib/format";
import { deriveChecklist } from "@/lib/onboarding";
import { buildSeed, type StoredEvent, type UserPrefs } from "@/lib/seed";

type SnapshotListener = {
  actor: Actor;
  origin: string;
  fn: (snapshot: LobbySnapshot) => void;
};

type ClaimInput = {
  eventCode: string;
  name: string;
  botColor: string;
  shareLevel: ShareLevel;
  hasGrokBot: boolean;
  acceptPermissions: boolean;
};

type SyncInput = {
  eventId: string;
  botId: string;
  taskLabel: string;
  status: TokenStatus;
  focus?: string;
  shareLevel?: ShareLevel;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hydrateSquads(event: StoredEvent): void {
  event.squads = event.squads.map((squad) => ({
    ...squad,
    members: event.attendees.filter((attendee) => attendee.squadId === squad.id),
  }));
}

export class LobbyMemory {
  private events = new Map<string, StoredEvent>();
  private tokens = new Map<string, LobbyToken>();
  private profiles = new Map<string, LumaProfile>();
  private presence = new Map<string, PresenceRecord>();
  private prefs = new Map<string, UserPrefs>();
  private claimed = new Map<string, Set<string>>();
  private shareCopied = new Set<string>();
  private exchanges = new Map<string, TokenExchangeRequest>();
  private listeners = new Map<string, Set<SnapshotListener>>();

  constructor() {
    this.loadSeed();
  }

  private loadSeed(): void {
    const seed = buildSeed();
    for (const event of seed.events) {
      this.events.set(event.id, event);
    }
    for (const token of seed.tokens) {
      this.tokens.set(tokenKey(token.eventId, token.botId), token);
    }
    for (const profile of seed.profiles) {
      this.profiles.set(profile.userId, profile);
    }
    for (const record of seed.presence) {
      this.presence.set(tokenKey(record.eventId, record.userId), record);
    }
    for (const [userId, prefs] of seed.prefs) {
      this.prefs.set(userId, prefs);
    }
    for (const [eventId, userIds] of seed.claimed) {
      this.claimed.set(eventId, new Set(userIds));
    }
    for (const eventId of seed.shareCopied) {
      this.shareCopied.add(eventId);
    }
  }

  actor(slot: IdentitySlot, userId: string | null, event: StoredEvent | null): Actor {
    if (!event) {
      const role = slot === "you" && userId === HOST_USER_ID ? "host" : userId ? "guest" : "guest";
      return { slot, userId, role };
    }
    return {
      slot,
      userId,
      role: roleForEvent(userId, event.hostUserId, event),
    };
  }

  listEvents(): Event[] {
    return [...this.events.values()].map((event) => this.presentEvent(event, null));
  }

  getStored(eventId: string): StoredEvent | null {
    return this.events.get(eventId) ?? null;
  }

  getByCode(code: string): StoredEvent | null {
    const needle = code.trim().toUpperCase();
    return [...this.events.values()].find((event) => event.eventCode === needle) ?? null;
  }

  snapshot(args: {
    eventId?: string;
    code?: string;
    actor: Actor;
    origin: string;
  }): LobbySnapshot {
    const stored = args.eventId
      ? this.getStored(args.eventId)
      : args.code
        ? this.getByCode(args.code)
        : this.getStored(SEED_EVENT_ID);
    const event = stored ? this.presentEvent(stored, args.actor.userId) : null;
    const eventId = stored?.id ?? null;
    const tokens = eventIdTokens(this.tokens, eventId)
      .filter((token) => this.shouldPresentToken(token, args.actor))
      .map((token) => this.presentToken(token, args.actor));
    const presence = eventIdPresence(this.presence, eventId).map((record) => ({
      ...record,
      state: presenceState(record),
    }));
    const claimedUserIds = eventId ? [...(this.claimed.get(eventId) ?? [])] : [];
    const session = this.sessionView(args.actor, stored);
    const join = stored ? joinUrl(args.origin, stored.eventCode) : null;
    const profiles = event
      ? event.attendees
          .map((attendee) => this.profiles.get(attendee.id))
          .filter((profile): profile is LumaProfile => Boolean(profile))
      : [];
    const exchanges = eventId ? this.exchangesFor(eventId) : [];
    const pendingApprovalCount = exchanges.filter((item) => item.status === "pending").length;
    const activeBotCount = presence.filter((record) => record.state === "active").length;

    return {
      event,
      events: this.listEvents(),
      tokens,
      presence,
      profiles,
      exchanges,
      session,
      joinUrl: join,
      checklist: deriveChecklist({
        event,
        session,
        tokens,
        shareCopied: stored ? this.shareCopied.has(stored.id) : false,
        claimedUserIds,
      }),
      activeBotCount,
      pendingApprovalCount,
    };
  }

  subscribe(eventId: string, actor: Actor, origin: string, fn: SnapshotListener["fn"]): () => void {
    const listener: SnapshotListener = { actor, origin, fn };
    const bucket = this.listeners.get(eventId) ?? new Set<SnapshotListener>();
    bucket.add(listener);
    this.listeners.set(eventId, bucket);
    return () => {
      bucket.delete(listener);
    };
  }

  createEvent(actor: Actor, name: string, date: string, origin: string): { event: Event; joinUrl: string } {
    if (!canCreateEvent(actor) || !actor.userId) {
      throw new LobbyError("Only the host slot can open a lobby.", 403);
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new LobbyError("Name the room first.", 400);
    }
    const id = createId("event");
    let code = createEventCode();
    while (this.getByCode(code)) {
      code = createEventCode();
    }
    const host = this.hostAttendee(actor.userId, id);
    const stored: StoredEvent = {
      id,
      name: trimmed,
      date,
      attendees: [host],
      squads: [],
      eventCode: code,
      hostUserId: actor.userId,
    };
    this.events.set(id, stored);
    this.claimed.set(id, new Set([actor.userId]));
    this.ensurePresence(id, actor.userId, true);
    this.emit(id);
    return { event: this.presentEvent(stored, actor.userId), joinUrl: joinUrl(origin, code) };
  }

  markShareCopied(actor: Actor, eventId: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    if (!canShareEvent(this.actor(actor.slot, actor.userId, stored))) {
      throw new LobbyError("Only the host can share this lobby.", 403);
    }
    this.shareCopied.add(eventId);
    this.emit(eventId);
    return this.snapshot({ eventId, actor, origin: "" });
  }

  claim(actor: Actor, input: ClaimInput, origin: string): { snapshot: LobbySnapshot; userId: string } {
    const stored = this.getByCode(input.eventCode);
    if (!stored) {
      throw new LobbyError("That code isn't a live lobby. Ask the host to copy the join link again.", 404);
    }
    const liveActor = this.actor(actor.slot, actor.userId, stored);
    const byName = stored.attendees.find(
      (person) =>
        person.name.toLowerCase() === input.name.trim().toLowerCase() &&
        (this.claimed.get(stored.id)?.has(person.id) ?? false) &&
        !person.id.startsWith("demo_"),
    );
    if (byName) {
      this.ensurePresence(stored.id, byName.id, true);
      const namedActor: Actor = { slot: "attendee", userId: byName.id, role: "attendee" };
      this.emit(stored.id);
      return { snapshot: this.snapshot({ eventId: stored.id, actor: namedActor, origin }), userId: byName.id };
    }
    if (liveActor.userId && this.claimed.get(stored.id)?.has(liveActor.userId)) {
      return { snapshot: this.snapshot({ eventId: stored.id, actor: liveActor, origin }), userId: liveActor.userId };
    }
    if (!canClaimBot(liveActor, stored)) {
      throw new LobbyError("Claim from the attendee tab — host is already in the grid.", 403);
    }
    const name = input.name.trim();
    if (!name) {
      throw new LobbyError("Name your bot.", 400);
    }
    if (stored.attendees.some((attendee) => attendee.id === actor.userId)) {
      throw new LobbyError("This bot is already in the room.", 409);
    }
    const userId = liveActor.userId ?? createId("user");
    const person: Attendee = {
      id: userId,
      name,
      botColor: input.botColor,
      eventId: stored.id,
      rsvpStatus: "going",
      isCurrentUser: false,
    };
    stored.attendees = [...stored.attendees, person];
    const claimed = this.claimed.get(stored.id) ?? new Set<string>();
    claimed.add(userId);
    this.claimed.set(stored.id, claimed);
    this.prefs.set(userId, {
      permissionsAccepted: input.acceptPermissions,
      shareLevel: input.shareLevel,
      shareTokens: true,
      hasGrokBot: input.hasGrokBot,
    });
    this.ensurePresence(stored.id, userId, true);
    const nextActor: Actor = { slot: "attendee", userId, role: "attendee" };
    this.emit(stored.id);
    return {
      snapshot: this.snapshot({ eventId: stored.id, actor: nextActor, origin }),
      userId,
    };
  }

  sync(actor: Actor, input: SyncInput): LobbySnapshot {
    const stored = this.requireEvent(input.eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    if (!canSyncToken(live, input.botId)) {
      throw new LobbyError("You can only sync your own bot token.", 403);
    }
    const label = input.taskLabel.trim();
    if (!label) {
      throw new LobbyError("Give the token a label.", 400);
    }
    const prefs = this.prefs.get(input.botId);
    const token: LobbyToken = {
      botId: input.botId,
      eventId: input.eventId,
      taskLabel: label,
      status: input.status,
      focus: input.focus?.trim() || undefined,
      timestamp: new Date().toISOString(),
      shareLevel: input.shareLevel ?? prefs?.shareLevel ?? "label+status",
    };
    this.tokens.set(tokenKey(input.eventId, input.botId), token);
    const attendee = stored.attendees.find((person) => person.id === input.botId);
    if (attendee) {
      attendee.botTaskLabel = label;
    }
    if (prefs && input.shareLevel) {
      this.prefs.set(input.botId, { ...prefs, shareLevel: input.shareLevel });
    }
    this.ensurePresence(input.eventId, input.botId, true);
    this.emit(input.eventId);
    return this.snapshot({ eventId: input.eventId, actor: live, origin: "" });
  }

  heartbeat(actor: Actor, eventId: string, botId: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    if (!canHeartbeat(live, botId)) {
      throw new LobbyError("You can only heartbeat your own bot.", 403);
    }
    this.ensurePresence(eventId, botId, true);
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  invite(actor: Actor, eventId: string, attendeeId: string, squadId?: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    const target = stored.attendees.find((person) => person.id === attendeeId);
    if (!target) {
      throw new LobbyError("That attendee isn't in this lobby.", 404);
    }
    const squad = squadId
      ? stored.squads.find((item) => item.id === squadId)
      : this.squadForInvite(stored, live);
    if (squad && !canInviteToSquad(live, stored, squad)) {
      throw new LobbyError("You can't invite to that squad.", 403);
    }
    if (!squad) {
      if (!canInviteToSquad(live, stored)) {
        throw new LobbyError("You can't invite to a squad.", 403);
      }
    }
    const destination = squad ?? this.createSquad(stored, live.userId ?? stored.hostUserId);
    if (live.userId && live.userId !== target.id) {
      const organizer = stored.attendees.find((person) => person.id === live.userId);
      if (organizer && organizer.squadId !== destination.id) {
        this.moveToSquad(stored, live.userId, destination.id);
      }
    }
    this.moveToSquad(stored, target.id, destination.id);
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  requestJoin(actor: Actor, eventId: string, squadId: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    if (!live.userId) {
      throw new LobbyError("Claim your bot before requesting a squad.", 403);
    }
    const squad = stored.squads.find((item) => item.id === squadId);
    if (!squad) {
      throw new LobbyError("That squad isn't here.", 404);
    }
    if (!canRequestJoin(live, squad)) {
      throw new LobbyError("This squad is closed, or you're already in it.", 403);
    }
    this.moveToSquad(stored, live.userId, squad.id);
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  leaveSquad(actor: Actor, eventId: string, squadId?: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    if (!live.userId) {
      throw new LobbyError("Claim your bot before leaving a squad.", 403);
    }
    const attendee = stored.attendees.find((person) => person.id === live.userId);
    const targetId = squadId ?? attendee?.squadId;
    const squad = stored.squads.find((item) => item.id === targetId);
    if (!attendee || !squad) {
      throw new LobbyError("You're not in that squad.", 404);
    }
    if (!canLeaveSquad(live, squad)) {
      throw new LobbyError("You're not in that squad.", 403);
    }
    stored.attendees = stored.attendees.map((person) =>
      person.id === live.userId ? { ...person, squadId: undefined } : person,
    );
    hydrateSquads(stored);
    const remaining = stored.squads.find((item) => item.id === squad.id);
    if (remaining && remaining.members.length === 0) {
      stored.squads = stored.squads.filter((item) => item.id !== squad.id);
    } else if (remaining && remaining.organizerId === live.userId && remaining.members[0]) {
      remaining.organizerId = remaining.members[0].id;
    }
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  proposeExchange(
    actor: Actor,
    input: {
      eventId: string;
      fromBotId: string;
      toBotId?: string;
      toSquadId?: string;
      taskLabel?: string;
      status?: TokenStatus;
      focus?: string;
      shareLevel?: ShareLevel;
    },
  ): LobbySnapshot {
    const stored = this.requireEvent(input.eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    if (!canProposeExchange(live, input.fromBotId)) {
      throw new LobbyError("You can only propose a token from your own bot.", 403);
    }
    if (input.toBotId && !stored.attendees.some((person) => person.id === input.toBotId)) {
      throw new LobbyError("That bot isn't in this lobby.", 404);
    }
    if (input.toSquadId && !stored.squads.some((squad) => squad.id === input.toSquadId)) {
      throw new LobbyError("That squad isn't here.", 404);
    }
    const current = this.tokens.get(tokenKey(input.eventId, input.fromBotId));
    const label = (input.taskLabel ?? current?.taskLabel ?? "").trim();
    if (!label) {
      throw new LobbyError("Sync a task token before proposing an exchange.", 400);
    }
    const token: LobbyToken = {
      botId: input.fromBotId,
      eventId: input.eventId,
      taskLabel: label,
      status: input.status ?? current?.status ?? "working",
      focus: input.focus ?? current?.focus,
      timestamp: new Date().toISOString(),
      shareLevel: input.shareLevel ?? current?.shareLevel ?? "label+status",
    };
    const request: TokenExchangeRequest = {
      id: createId("xchg"),
      eventId: input.eventId,
      fromBotId: input.fromBotId,
      toBotId: input.toBotId,
      toSquadId: input.toSquadId,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.exchanges.set(request.id, request);
    this.emit(input.eventId);
    return this.snapshot({ eventId: input.eventId, actor: live, origin: "" });
  }

  resolveExchange(actor: Actor, eventId: string, requestId: string, status: ExchangeStatus): LobbySnapshot {
    if (status === "pending") {
      throw new LobbyError("Resolve with approved or rejected.", 400);
    }
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor.slot, actor.userId, stored);
    const request = this.exchanges.get(requestId);
    if (!request || request.eventId !== eventId) {
      throw new LobbyError("No token exchange with that id.", 404);
    }
    if (request.status !== "pending") {
      throw new LobbyError("That exchange is already resolved.", 409);
    }
    if (!canResolveExchange(live, request, stored)) {
      throw new LobbyError("Only the recipient, squad organizer, or host can resolve this.", 403);
    }
    request.status = status;
    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = live.userId ?? undefined;
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  context(actor: Actor, eventId: string, botId: string): BotContext {
    const stored = this.requireEvent(eventId);
    const attendee = stored.attendees.find((person) => person.id === botId);
    if (!attendee) {
      throw new LobbyError("No bot with that id in this lobby.", 404);
    }
    const live = this.actor(actor.slot, actor.userId, stored);
    const record = this.presence.get(tokenKey(eventId, botId)) ?? {
      userId: botId,
      eventId,
      lastHeartbeat: null,
      claimed: false,
    };
    const rawToken = this.tokens.get(tokenKey(eventId, botId)) ?? null;
    const exchanges = this.exchangesFor(eventId);
    return {
      attendee: this.presentAttendee(attendee, live.userId),
      profile: this.profiles.get(botId) ?? null,
      token:
        rawToken && this.shouldPresentToken(rawToken, live)
          ? this.presentToken(rawToken, live)
          : null,
      presence: { ...record, state: presenceState(record) },
      exchanges,
      receivedTokens: receivedTokensFor(exchanges, botId, attendee.squadId),
    };
  }

  updatePrefs(
    actor: Actor,
    input: {
      shareLevel?: ShareLevel;
      shareTokens?: boolean;
      permissionsAccepted?: boolean;
      hasGrokBot?: boolean;
    },
    eventId: string,
  ): LobbySnapshot {
    if (!actor.userId) {
      throw new LobbyError("No bot to edit.", 403);
    }
    const current = this.prefs.get(actor.userId) ?? {
      permissionsAccepted: false,
      shareLevel: "label+status" as ShareLevel,
      shareTokens: true,
      hasGrokBot: false,
    };
    this.prefs.set(actor.userId, {
      permissionsAccepted: input.permissionsAccepted ?? current.permissionsAccepted,
      shareLevel: input.shareLevel ?? current.shareLevel,
      shareTokens: input.shareTokens ?? current.shareTokens,
      hasGrokBot: input.hasGrokBot ?? current.hasGrokBot,
    });
    const token = this.tokens.get(tokenKey(eventId, actor.userId));
    if (token && input.shareLevel) {
      token.shareLevel = input.shareLevel;
    }
    this.emit(eventId);
    return this.snapshot({ eventId, actor, origin: "" });
  }

  private hostAttendee(userId: string, eventId: string): Attendee {
    const existing = [...this.events.values()]
      .flatMap((event) => event.attendees)
      .find((person) => person.id === userId);
    return {
      id: userId,
      name: existing?.name ?? "Francisco",
      botColor: existing?.botColor ?? BOT_COLORS.coral,
      lumaHandle: existing?.lumaHandle,
      lumaProfileUrl: existing?.lumaProfileUrl,
      eventId,
      rsvpStatus: "going",
      isCurrentUser: false,
    };
  }

  private squadForInvite(event: StoredEvent, actor: Actor): Squad | undefined {
    if (actor.userId) {
      const mine = event.squads.find((squad) => squad.organizerId === actor.userId);
      if (mine) {
        return mine;
      }
      const memberOf = event.squads.find((squad) => squad.members.some((member) => member.id === actor.userId));
      if (memberOf) {
        return memberOf;
      }
    }
    return undefined;
  }

  private createSquad(event: StoredEvent, organizerId: string): Squad {
    const squad: Squad = {
      id: createId("squad"),
      eventId: event.id,
      name: `Group ${event.squads.length + 1}`,
      organizerId,
      members: [],
      isOpen: true,
    };
    event.squads = [...event.squads, squad];
    return squad;
  }

  private moveToSquad(event: StoredEvent, attendeeId: string, squadId: string): void {
    event.attendees = event.attendees.map((person) =>
      person.id === attendeeId ? { ...person, squadId } : person,
    );
    hydrateSquads(event);
  }

  private ensurePresence(eventId: string, userId: string, claimed: boolean): void {
    this.presence.set(tokenKey(eventId, userId), {
      userId,
      eventId,
      lastHeartbeat: new Date().toISOString(),
      claimed,
    });
  }

  private requireEvent(eventId: string): StoredEvent {
    const stored = this.getStored(eventId);
    if (!stored) {
      throw new LobbyError("No lobby with that id.", 404);
    }
    return stored;
  }

  private sessionView(actor: Actor, stored: StoredEvent | null): SessionView {
    const prefs = actor.userId ? this.prefs.get(actor.userId) : undefined;
    const claimed = Boolean(
      stored && actor.userId && this.claimed.get(stored.id)?.has(actor.userId),
    );
    return {
      userId: actor.userId,
      role: stored ? roleForEvent(actor.userId, stored.hostUserId, stored) : actor.role,
      slot: actor.slot,
      claimed,
      permissionsAccepted: prefs?.permissionsAccepted ?? false,
      shareLevel: prefs?.shareLevel ?? "label+status",
      shareTokens: prefs?.shareTokens ?? true,
      hasGrokBot: prefs?.hasGrokBot ?? actor.slot === "you",
    };
  }

  private presentEvent(stored: StoredEvent, currentUserId: string | null): Event {
    hydrateSquads(stored);
    return {
      id: stored.id,
      name: stored.name,
      date: stored.date,
      lumaEventId: stored.lumaEventId,
      eventCode: stored.eventCode,
      attendees: stored.attendees.map((person) => this.presentAttendee(person, currentUserId)),
      squads: stored.squads.map((squad) => ({
        ...squad,
        members: squad.members.map((member) => this.presentAttendee(member, currentUserId)),
      })),
    };
  }

  private presentAttendee(attendee: Attendee, currentUserId: string | null): Attendee {
    return {
      ...attendee,
      isCurrentUser: currentUserId !== null && attendee.id === currentUserId,
    };
  }

  private shouldPresentToken(token: LobbyToken, actor: Actor): boolean {
    if (canViewFullToken(actor, token.botId)) {
      return true;
    }
    const prefs = this.prefs.get(token.botId);
    return prefs?.shareTokens ?? true;
  }

  private presentToken(token: LobbyToken, actor: Actor): LobbyToken {
    if (canViewFullToken(actor, token.botId)) {
      return clone(token);
    }
    switch (token.shareLevel) {
      case "label":
        return {
          ...token,
          status: "idle",
          focus: undefined,
        };
      case "label+status":
        return { ...token, focus: undefined };
      case "full":
        return clone(token);
      default:
        return assertNever(token.shareLevel, "share level");
    }
  }

  private exchangesFor(eventId: string): TokenExchangeRequest[] {
    return [...this.exchanges.values()].filter((item) => item.eventId === eventId);
  }

  private emit(eventId: string): void {
    const listeners = this.listeners.get(eventId);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener.fn(this.snapshot({ eventId, actor: listener.actor, origin: listener.origin }));
    }
  }
}

export class LobbyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function eventIdTokens(tokens: Map<string, LobbyToken>, eventId: string | null): LobbyToken[] {
  if (!eventId) {
    return [];
  }
  return [...tokens.values()].filter((token) => token.eventId === eventId);
}

function eventIdPresence(
  presence: Map<string, PresenceRecord>,
  eventId: string | null,
): PresenceRecord[] {
  if (!eventId) {
    return [];
  }
  return [...presence.values()].filter((record) => record.eventId === eventId);
}

const globalForLobby = globalThis as typeof globalThis & { __gblLobby?: LobbyMemory };

export function getLobby(): LobbyMemory {
  if (!globalForLobby.__gblLobby) {
    globalForLobby.__gblLobby = new LobbyMemory();
  }
  return globalForLobby.__gblLobby;
}
