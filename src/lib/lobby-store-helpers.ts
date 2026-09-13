import type { LobbyToken, PresenceRecord } from "@/lib/domain";
import type { StoredEvent } from "@/lib/seed";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function hydrateSquads(event: StoredEvent): void {
  event.squads = event.squads.map((squad) => ({
    ...squad,
    members: event.attendees.filter((attendee) => attendee.squadId === squad.id),
  }));
}

export function eventIdTokens(tokens: Map<string, LobbyToken>, eventId: string | null): LobbyToken[] {
  if (!eventId) {
    return [];
  }
  return [...tokens.values()].filter((token) => token.eventId === eventId);
}

export function eventIdPresence(
  presence: Map<string, PresenceRecord>,
  eventId: string | null,
): PresenceRecord[] {
  if (!eventId) {
    return [];
  }
  return [...presence.values()].filter((record) => record.eventId === eventId);
}

export class LobbyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LobbyError";
    this.status = status;
  }
}

export type LobbyErrorPayload = {
  __lobbyError: {
    message: string;
    status: number;
  };
};

export function isLobbyErrorPayload(value: unknown): value is LobbyErrorPayload {
  if (typeof value !== "object" || value === null || !("__lobbyError" in value)) {
    return false;
  }
  const payload = (value as LobbyErrorPayload).__lobbyError;
  return typeof payload.message === "string" && typeof payload.status === "number";
}

export function lobbyErrorPayload(error: LobbyError): LobbyErrorPayload {
  return { __lobbyError: { message: error.message, status: error.status } };
}
