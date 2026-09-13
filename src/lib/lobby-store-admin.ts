import type {
  Actor,
  LobbySnapshot,
  LobbyToken,
  PresenceRecord,
  SquadInvite,
  TokenExchangeRequest,
} from "@/lib/domain";
import { canDeleteEvent, canKickAttendee, canRemoveFromSquad } from "@/lib/policy";
import { hydrateSquads, LobbyError } from "@/lib/lobby-store-helpers";
import { tokenKey } from "@/lib/domain";
import type { StoredEvent } from "@/lib/seed";

export type AdminStore = {
  events: Map<string, StoredEvent>;
  tokens: Map<string, LobbyToken>;
  presence: Map<string, PresenceRecord>;
  claimed: Map<string, Set<string>>;
  exchanges: Map<string, TokenExchangeRequest>;
  squadInvites: Map<string, SquadInvite>;
  shareCopied: Set<string>;
  requireEvent(eventId: string): StoredEvent;
  actor(actor: Actor, event: StoredEvent | null): Actor;
  snapshot(eventId: string | undefined, actor: Actor): LobbySnapshot;
  emit(eventId: string): void;
};

function dropPersonMaps(
  store: AdminStore,
  eventId: string,
  attendeeId: string,
): void {
  store.tokens.delete(tokenKey(eventId, attendeeId));
  store.presence.delete(tokenKey(eventId, attendeeId));
  store.claimed.get(eventId)?.delete(attendeeId);
  for (const [id, invite] of store.squadInvites) {
    if (invite.eventId === eventId && (invite.fromBotId === attendeeId || invite.toBotId === attendeeId)) {
      store.squadInvites.delete(id);
    }
  }
  for (const [id, exchange] of store.exchanges) {
    if (
      exchange.eventId === eventId &&
      (exchange.fromBotId === attendeeId || exchange.toBotId === attendeeId)
    ) {
      store.exchanges.delete(id);
    }
  }
}

export function kickAttendee(store: AdminStore, actor: Actor, eventId: string, attendeeId: string): LobbySnapshot {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
  if (!canKickAttendee(live, stored, attendeeId)) {
    throw new LobbyError("Only the host can kick another attendee.", 403);
  }
  stored.attendees = stored.attendees.filter((person) => person.id !== attendeeId);
  hydrateSquads(stored);
  stored.squads = stored.squads.filter((squad) => squad.members.length > 0);
  dropPersonMaps(store, eventId, attendeeId);
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

export function removeFromSquad(
  store: AdminStore,
  actor: Actor,
  eventId: string,
  squadId: string,
  attendeeId: string,
): LobbySnapshot {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
  const squad = stored.squads.find((item) => item.id === squadId);
  if (!squad) {
    throw new LobbyError("That squad isn't here.", 404);
  }
  if (!canRemoveFromSquad(live, squad, attendeeId)) {
    throw new LobbyError("You can't remove that member.", 403);
  }
  stored.attendees = stored.attendees.map((person) =>
    person.id === attendeeId ? { ...person, squadId: undefined } : person,
  );
  hydrateSquads(stored);
  const remaining = stored.squads.find((item) => item.id === squadId);
  if (remaining && remaining.members.length === 0) {
    stored.squads = stored.squads.filter((item) => item.id !== squadId);
  } else if (remaining && remaining.organizerId === attendeeId && remaining.members[0]) {
    remaining.organizerId = remaining.members[0].id;
  }
  store.emit(eventId);
  return store.snapshot(eventId, live);
}

export function deleteEvent(store: AdminStore, actor: Actor, eventId: string): { ok: true } {
  const stored = store.requireEvent(eventId);
  const live = store.actor(actor, stored);
  if (!canDeleteEvent(live, stored)) {
    throw new LobbyError("Only the host can delete this event.", 403);
  }
  store.events.delete(eventId);
  store.claimed.delete(eventId);
  store.shareCopied.delete(eventId);
  for (const [key, token] of store.tokens) {
    if (token.eventId === eventId) {
      store.tokens.delete(key);
    }
  }
  for (const [key, record] of store.presence) {
    if (record.eventId === eventId) {
      store.presence.delete(key);
    }
  }
  for (const [id, exchange] of store.exchanges) {
    if (exchange.eventId === eventId) {
      store.exchanges.delete(id);
    }
  }
  for (const [id, invite] of store.squadInvites) {
    if (invite.eventId === eventId) {
      store.squadInvites.delete(id);
    }
  }
  store.emit(eventId);
  return { ok: true };
}
