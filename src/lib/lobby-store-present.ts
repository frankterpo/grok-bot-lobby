import {
  type Actor,
  type Attendee,
  type Event,
  type LobbyToken,
  assertNever,
} from "@/lib/domain";
import { clone, hydrateSquads } from "@/lib/lobby-store-helpers";
import type { StoredEvent } from "@/lib/seed";
import { canViewFullToken, roleForEvent } from "@/lib/policy";

export function presentAttendee(attendee: Attendee, currentUserId: string | null): Attendee {
  return {
    ...attendee,
    isCurrentUser: currentUserId !== null && attendee.id === currentUserId,
  };
}

export function presentEvent(stored: StoredEvent, currentUserId: string | null): Event {
  hydrateSquads(stored);
  return {
    id: stored.id,
    name: stored.name,
    date: stored.date,
    lumaEventId: stored.lumaEventId,
    eventCode: stored.eventCode,
    attendees: stored.attendees.map((person) => presentAttendee(person, currentUserId)),
    squads: stored.squads.map((squad) => ({
      ...squad,
      members: squad.members.map((member) => presentAttendee(member, currentUserId)),
    })),
  };
}

export function shouldPresentToken(
  token: LobbyToken,
  actor: Actor,
  prefsShareTokens: (botId: string) => boolean | undefined,
): boolean {
  if (canViewFullToken(actor, token.botId)) {
    return true;
  }
  return prefsShareTokens(token.botId) ?? true;
}

export function presentToken(token: LobbyToken, actor: Actor): LobbyToken {
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

export function sessionRole(actor: Actor, stored: StoredEvent | null): Actor["role"] {
  if (!stored || !actor.userId) {
    return actor.role;
  }
  let role = roleForEvent(actor.userId, stored.hostUserId, {
    id: stored.id,
    name: stored.name,
    date: stored.date,
    lumaEventId: stored.lumaEventId,
    eventCode: stored.eventCode,
    attendees: stored.attendees,
    squads: stored.squads,
  });
  if (role === "host" && !actor.hostAuthenticated) {
    role = stored.attendees.some((person) => person.id === actor.userId) ? "attendee" : "guest";
  }
  return role;
}
