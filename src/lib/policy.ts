import type { Actor, Event, Squad } from "@/lib/domain";

export function roleForEvent(userId: string | null, hostUserId: string, event: Event): Actor["role"] {
  if (!userId) {
    return "guest";
  }
  if (userId === hostUserId) {
    return "host";
  }
  if (event.attendees.some((attendee) => attendee.id === userId)) {
    return "attendee";
  }
  return "guest";
}

export function canCreateEvent(actor: Actor): boolean {
  return actor.hostAuthenticated === true && actor.role === "host";
}

export function canShareEvent(actor: Actor): boolean {
  return actor.hostAuthenticated === true && actor.role === "host";
}

export function canClaimBot(actor: Actor, event: Event): boolean {
  if (actor.slot !== "attendee") {
    return false;
  }
  if (!actor.userId) {
    return true;
  }
  return !event.attendees.some((attendee) => attendee.id === actor.userId);
}

export function canEditOwnBot(actor: Actor, attendeeId: string): boolean {
  return actor.userId !== null && actor.userId === attendeeId && actor.role !== "guest";
}

export function canSyncToken(actor: Actor, botId: string): boolean {
  return canEditOwnBot(actor, botId);
}

export function canHeartbeat(actor: Actor, botId: string): boolean {
  return canEditOwnBot(actor, botId);
}

export function canInviteToSquad(actor: Actor, _event: Event, squad?: Squad): boolean {
  if (actor.userId === null) {
    return false;
  }
  if (actor.role === "guest") {
    return false;
  }
  if (squad) {
    return actor.role === "host" || squad.organizerId === actor.userId;
  }
  return actor.role === "host" || actor.role === "attendee";
}

export function canRequestJoin(actor: Actor, squad: Squad): boolean {
  if (actor.userId === null) {
    return false;
  }
  if (actor.role === "guest") {
    return false;
  }
  if (!squad.isOpen) {
    return false;
  }
  return !squad.members.some((member) => member.id === actor.userId);
}

export function canViewFullToken(actor: Actor, botId: string): boolean {
  return actor.userId !== null && actor.userId === botId;
}

export function canLeaveSquad(actor: Actor, squad: Squad): boolean {
  if (actor.userId === null) {
    return false;
  }
  return squad.members.some((member) => member.id === actor.userId);
}

export function canProposeExchange(actor: Actor, fromBotId: string): boolean {
  return actor.userId !== null && actor.userId === fromBotId;
}

export function canResolveExchange(
  actor: Actor,
  request: { toBotId?: string; toSquadId?: string },
  event: Event,
): boolean {
  if (actor.userId === null) {
    return false;
  }
  if (actor.role === "host") {
    return true;
  }
  if (request.toBotId && actor.userId === request.toBotId) {
    return true;
  }
  if (request.toSquadId) {
    const squad = event.squads.find((item) => item.id === request.toSquadId);
    return Boolean(squad && squad.organizerId === actor.userId);
  }
  return false;
}
