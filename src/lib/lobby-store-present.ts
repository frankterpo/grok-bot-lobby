import {
  type Actor,
  type Attendee,
  type Event,
  type LobbyToken,
  type SessionView,
  type ShareLevel,
  assertNever,
} from "@/lib/domain";
import { canViewFullToken, roleForEvent } from "@/lib/policy";
import { clone, hydrateSquads } from "@/lib/lobby-store-helpers";
import type { StoredEvent, UserPrefs } from "@/lib/seed";

export type PresentPrefs = Map<string, UserPrefs>;
export type PresentClaimed = Map<string, Set<string>>;

export function sessionView(
  actor: Actor,
  stored: StoredEvent | null,
  prefs: PresentPrefs,
  claimed: PresentClaimed,
): SessionView {
  const userPrefs = actor.userId ? prefs.get(actor.userId) : undefined;
  const isClaimed = Boolean(stored && actor.userId && claimed.get(stored.id)?.has(actor.userId));
  return {
    userId: actor.userId,
    role: stored ? roleForEvent(actor.userId, stored.hostUserId, stored) : actor.role,
    slot: actor.slot,
    claimed: isClaimed,
    permissionsAccepted: userPrefs?.permissionsAccepted ?? false,
    shareLevel: userPrefs?.shareLevel ?? "label+status",
    shareTokens: userPrefs?.shareTokens ?? true,
    hasGrokBot: userPrefs?.hasGrokBot ?? actor.slot === "you",
  };
}

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

export function shouldPresentToken(token: LobbyToken, actor: Actor, prefs: PresentPrefs): boolean {
  if (canViewFullToken(actor, token.botId)) {
    return true;
  }
  return prefs.get(token.botId)?.shareTokens ?? true;
}

export function presentToken(token: LobbyToken, actor: Actor, prefs: PresentPrefs): LobbyToken {
  if (canViewFullToken(actor, token.botId)) {
    return clone(token);
  }
  switch (token.shareLevel) {
    case "label":
      return { ...token, status: "idle", focus: undefined };
    case "label+status":
      return { ...token, focus: undefined };
    case "full":
      return clone(token);
    default:
      return assertNever(token.shareLevel, "share level");
  }
}
