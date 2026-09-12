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
  assertNever,
  createEventCode,
  createId,
  presenceState,
  receivedTokensFor,
  tokenKey,
} from "@/lib/domain";
import { joinUrl } from "@/lib/format";
import { applyProfileInputs, profileInputsFromAttendee } from "@/lib/lobby-profiles";
import { deriveChecklist } from "@/lib/onboarding";
import { buildToken, tokensEqual, truncateTaskLabel } from "@/lib/token-utils";
import {
  emptyPersistedState,
  type PersistedLobbyState,
} from "@/lib/lobby-persisted";
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
  lumaProfileUrl?: string;
  lumaHandle?: string;
  githubProfileUrl?: string;
  githubHandle?: string;
  originProfileUrl?: string;
  originHandle?: string;
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

type EmitFn = (eventId: string) => void;

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
  private externalEmit: EmitFn | null = null;

  constructor(options?: { seed?: boolean }) {
    if (options?.seed !== false) {
      this.loadSeed();
    }
  }

  setEmitter(fn: EmitFn): void {
    this.externalEmit = fn;
  }

  static fromPersisted(state: PersistedLobbyState): LobbyMemory {
    const lobby = new LobbyMemory({ seed: false });
    for (const event of state.events) {
      lobby.events.set(event.id, event);
    }
    for (const [key, token] of state.tokens) {
      lobby.tokens.set(key, token);
    }
    for (const [userId, profile] of state.profiles) {
      lobby.profiles.set(userId, profile);
    }
    for (const [key, record] of state.presence) {
      lobby.presence.set(key, record);
    }
    for (const [userId, prefs] of state.prefs) {
      lobby.prefs.set(userId, prefs);
    }
    for (const [eventId, userIds] of state.claimed) {
      lobby.claimed.set(eventId, new Set(userIds));
    }
    for (const eventId of state.shareCopied) {
      lobby.shareCopied.add(eventId);
    }
    for (const [id, exchange] of state.exchanges) {
      lobby.exchanges.set(id, exchange);
    }
    return lobby;
  }

  toPersisted(): PersistedLobbyState {
    return {
      version: 1,
      events: [...this.events.values()],
      tokens: [...this.tokens.entries()],
      profiles: [...this.profiles.entries()],
      presence: [...this.presence.entries()],
      prefs: [...this.prefs.entries()],
      claimed: [...this.claimed.entries()].map(([eventId, ids]) => [eventId, [...ids]] as [string, string[]]),
      shareCopied: [...this.shareCopied],
      exchanges: [...this.exchanges.entries()],
    };
  }

  private loadSeed(): void {
    const seed = buildSeed();
    const empty = emptyPersistedState();
    empty.events = seed.events;
    empty.tokens = seed.tokens.map((token) => [tokenKey(token.eventId, token.botId), token]);
    empty.profiles = seed.profiles.map((profile) => [profile.userId, profile]);
    empty.presence = seed.presence.map((record) => [tokenKey(record.eventId, record.userId), record]);
    empty.prefs = seed.prefs;
    empty.claimed = seed.claimed;
    empty.shareCopied = seed.shareCopied;
    const restored = LobbyMemory.fromPersisted(empty);
    this.events = restored.events;
    this.tokens = restored.tokens;
    this.profiles = restored.profiles;
    this.presence = restored.presence;
    this.prefs = restored.prefs;
    this.claimed = restored.claimed;
    this.shareCopied = restored.shareCopied;
    this.exchanges = restored.exchanges;
  }

  actor(input: Actor, event: StoredEvent | null): Actor {
    const { slot, userId, hostAuthenticated = false } = input;
    if (!event) {
      const role = hostAuthenticated && userId ? "host" : userId ? "guest" : "guest";
      return { slot, userId, role, hostAuthenticated };
    }
    let role = roleForEvent(userId, event.hostUserId, event);
    if (role === "host" && !hostAuthenticated) {
      role = event.attendees.some((person) => person.id === userId) ? "attendee" : "guest";
    }
    return { slot, userId, role, hostAuthenticated };
  }

  /** @deprecated Prefer listEventsForActor — never expose all events publicly. */
  listEvents(): Event[] {
    return [...this.events.values()].map((event) => this.presentEvent(event, null));
  }

  listEventsForActor(actor: Actor): Event[] {
    if (!actor.userId) {
      return [];
    }
    return [...this.events.values()]
      .filter((event) => {
        if (event.hostUserId === actor.userId) {
          return true;
        }
        return event.attendees.some((person) => person.id === actor.userId);
      })
      .map((event) => this.presentEvent(event, actor.userId));
  }

  visibleEventsForActor(actor: Actor, activeEventId: string | null): Event[] {
    const scoped = this.listEventsForActor(actor);
    if (scoped.length > 0 || !activeEventId) {
      return scoped;
    }
    const active = this.getStored(activeEventId);
    if (!active) {
      return scoped;
    }
    return [this.presentEvent(active, actor.userId)];
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
        : this.events.size === 1
          ? ([...this.events.values()][0] ?? null)
          : null;
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
      events: this.visibleEventsForActor(args.actor, stored?.id ?? null),
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
    if (!canShareEvent(this.actor(actor, stored))) {
      throw new LobbyError("Only the host can share this lobby.", 403);
    }
    this.shareCopied.add(eventId);
    this.emit(eventId);
    return this.snapshot({ eventId, actor, origin: "" });
  }

  async claim(actor: Actor, input: ClaimInput, origin: string): Promise<{ snapshot: LobbySnapshot; userId: string }> {
    const stored = this.getByCode(input.eventCode);
    if (!stored) {
      throw new LobbyError("That code isn't a live lobby. Ask the host to copy the join link again.", 404);
    }
    const liveActor = this.actor(actor, stored);
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
      lumaProfileUrl: input.lumaProfileUrl?.trim(),
      lumaHandle: input.lumaHandle?.trim(),
      githubProfileUrl: input.githubProfileUrl?.trim(),
      githubHandle: input.githubHandle?.trim(),
      originProfileUrl: input.originProfileUrl?.trim(),
      originHandle: input.originHandle?.trim(),
      eventId: stored.id,
      rsvpStatus: "going",
      isCurrentUser: false,
    };
    stored.attendees = [...stored.attendees, person];
    await applyProfileInputs(stored, userId, profileInputsFromAttendee(person), this.profiles);
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
    const live = this.actor(actor, stored);
    if (!canSyncToken(live, input.botId)) {
      throw new LobbyError("You can only sync your own bot token.", 403);
    }
    const label = truncateTaskLabel(input.taskLabel);
    if (!label) {
      throw new LobbyError("Give the token a label.", 400);
    }
    const prefs = this.prefs.get(input.botId);
    const shareLevel = input.shareLevel ?? prefs?.shareLevel ?? "label+status";
    const key = tokenKey(input.eventId, input.botId);
    const existing = this.tokens.get(key);
    const next = buildToken({
      botId: input.botId,
      eventId: input.eventId,
      taskLabel: label,
      status: input.status,
      focus: input.focus,
      shareLevel,
    });
    if (existing && tokensEqual(existing, next)) {
      this.ensurePresence(input.eventId, input.botId, true);
      return this.snapshot({ eventId: input.eventId, actor: live, origin: "" });
    }
    this.tokens.set(key, next);
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
    const live = this.actor(actor, stored);
    if (!canHeartbeat(live, botId)) {
      throw new LobbyError("You can only heartbeat your own bot.", 403);
    }
    this.ensurePresence(eventId, botId, true);
    this.emit(eventId);
    return this.snapshot({ eventId, actor: live, origin: "" });
  }

  invite(actor: Actor, eventId: string, attendeeId: string, squadId?: string): LobbySnapshot {
    const stored = this.requireEvent(eventId);
    const live = this.actor(actor, stored);
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
    const live = this.actor(actor, stored);
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
    const live = this.actor(actor, stored);
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
    const live = this.actor(actor, stored);
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
    const live = this.actor(actor, stored);
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
    const live = this.actor(actor, stored);
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

  async updateProfile(
    actor: Actor,
    input: {
      eventId: string;
      botId: string;
      lumaProfileUrl?: string;
      lumaHandle?: string;
      githubProfileUrl?: string;
      githubHandle?: string;
      originProfileUrl?: string;
      originHandle?: string;
    },
  ): Promise<LobbySnapshot> {
    const stored = this.requireEvent(input.eventId);
    const live = this.actor(actor, stored);
    if (live.userId !== input.botId) {
      throw new LobbyError("You can only update your own bot profile.", 403);
    }
    await applyProfileInputs(stored, input.botId, input, this.profiles);
    this.emit(input.eventId);
    return this.snapshot({ eventId: input.eventId, actor: live, origin: "" });
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
    if (listeners) {
      for (const listener of listeners) {
        listener.fn(this.snapshot({ eventId, actor: listener.actor, origin: listener.origin }));
      }
    }
    this.externalEmit?.(eventId);
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
