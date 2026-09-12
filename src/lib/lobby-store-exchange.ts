import {
  type Actor,
  type ExchangeStatus,
  type LobbySnapshot,
  type LobbyToken,
  type ShareLevel,
  type Squad,
  type TokenExchangeRequest,
  type TokenStatus,
  createId,
  tokenKey,
} from "@/lib/domain";
import {
  canInviteToSquad,
  canLeaveSquad,
  canProposeExchange,
  canRequestJoin,
  canResolveExchange,
} from "@/lib/policy";
import { hydrateSquads, LobbyError } from "@/lib/lobby-store-helpers";
import type { StoredEvent } from "@/lib/seed";

export type ExchangeStore = {
  exchanges: Map<string, TokenExchangeRequest>;
  tokens: Map<string, LobbyToken>;
  requireEvent(eventId: string): StoredEvent;
  actor(actor: Actor, event: StoredEvent | null): Actor;
  snapshot(eventId: string, actor: Actor): LobbySnapshot;
  emit(eventId: string): void;
};

export function exchangesFor(store: ExchangeStore, eventId: string): TokenExchangeRequest[] {
  return [...store.exchanges.values()].filter((item) => item.eventId === eventId);
}

export function inviteToSquad(
  store: ExchangeStore,
  actor: Actor,
  eventId: string,
  attendeeId: string,
  squadId?: string,
): LobbySnapshot {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
  const target = stored.attendees.find((person) => person.id === attendeeId);
  if (!target) {
    throw new LobbyError("That attendee isn't in this lobby.", 404);
  }
  const squad = squadId
    ? stored.squads.find((item) => item.id === squadId)
    : squadForInvite(stored, live);
  if (squad && !canInviteToSquad(live, stored, squad)) {
    throw new LobbyError("You can't invite to that squad.", 403);
  }
  if (!squad && !canInviteToSquad(live, stored)) {
    throw new LobbyError("You can't invite to a squad.", 403);
  }
  const destination = squad ?? createSquad(stored, live.userId ?? stored.hostUserId);
  if (live.userId && live.userId !== target.id) {
    const organizer = stored.attendees.find((person) => person.id === live.userId);
    if (organizer && organizer.squadId !== destination.id) {
      moveToSquad(stored, live.userId, destination.id);
    }
  }
  moveToSquad(stored, target.id, destination.id);
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

export function requestJoinSquad(
  store: ExchangeStore,
  actor: Actor,
  eventId: string,
  squadId: string,
): LobbySnapshot {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
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
  moveToSquad(stored, live.userId, squad.id);
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

export function leaveSquad(
  store: ExchangeStore,
  actor: Actor,
  eventId: string,
  squadId?: string,
): LobbySnapshot {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
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
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

export function proposeExchange(
  store: ExchangeStore,
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
  const stored = store.requireEvent(input.eventId);
  const live = store.actor(actor, stored);
  if (!canProposeExchange(live, input.fromBotId)) {
    throw new LobbyError("You can only propose a token from your own bot.", 403);
  }
  if (input.toBotId && !stored.attendees.some((person) => person.id === input.toBotId)) {
    throw new LobbyError("That bot isn't in this lobby.", 404);
  }
  if (input.toSquadId && !stored.squads.some((squad) => squad.id === input.toSquadId)) {
    throw new LobbyError("That squad isn't here.", 404);
  }
  const attendee = stored.attendees.find((person) => person.id === input.fromBotId);
  const current = store.tokens.get(tokenKey(input.eventId, input.fromBotId));
  const label = (input.taskLabel ?? current?.taskLabel ?? attendee?.botTaskLabel ?? "").trim();
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
  store.exchanges.set(request.id, request);
  store.emit(input.eventId);
  return store.snapshot(input.eventId, live);
}

export function resolveExchange(
  store: ExchangeStore,
  actor: Actor,
  eventId: string,
  requestId: string,
  status: ExchangeStatus,
): LobbySnapshot {
  if (status === "pending") {
    throw new LobbyError("Resolve with approved or rejected.", 400);
  }
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
  const request = store.exchanges.get(requestId);
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
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

function squadForInvite(event: StoredEvent, actor: Actor): Squad | undefined {
  if (!actor.userId) {
    return undefined;
  }
  const mine = event.squads.find((squad) => squad.organizerId === actor.userId);
  if (mine) {
    return mine;
  }
  return event.squads.find((squad) => squad.members.some((member) => member.id === actor.userId));
}

function createSquad(event: StoredEvent, organizerId: string): Squad {
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

function moveToSquad(event: StoredEvent, attendeeId: string, squadId: string): void {
  event.attendees = event.attendees.map((person) =>
    person.id === attendeeId ? { ...person, squadId } : person,
  );
  hydrateSquads(event);
}
