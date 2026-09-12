import { HOST_USER_ID, SEED_EVENT_CODE, type IdentitySlot, type LobbySnapshot } from "@/lib/domain";
import { SLOT_HEADER } from "@/lib/identity";

export const SLOT_STORAGE_KEY = "gbl_as";
export const ONBOARD_STORAGE_KEY = "gbl_onboarded";
export const EVENT_STORAGE_KEY = "gbl_event";

export function readSlot(): IdentitySlot {
  if (typeof window === "undefined") {
    return "you";
  }
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("as");
  if (fromQuery === "attendee" || fromQuery === "you") {
    window.sessionStorage.setItem(SLOT_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  const stored = window.sessionStorage.getItem(SLOT_STORAGE_KEY);
  return stored === "attendee" ? "attendee" : "you";
}

export function writeSlot(slot: IdentitySlot): void {
  window.sessionStorage.setItem(SLOT_STORAGE_KEY, slot);
}

export async function lobbyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const slot = readSlot();
  const headers = new Headers(init.headers);
  headers.set(SLOT_HEADER, slot);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}

export async function fetchSnapshot(eventId?: string, code?: string): Promise<LobbySnapshot> {
  const params = new URLSearchParams();
  if (eventId) {
    params.set("eventId", eventId);
  }
  if (code) {
    params.set("code", code);
  }
  const response = await lobbyFetch(`/api/lobby/snapshot?${params.toString()}`);
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Could not load lobby.");
  }
  return (await response.json()) as LobbySnapshot;
}

export function streamUrl(eventId: string): string {
  const slot = readSlot();
  const params = new URLSearchParams({ eventId, as: slot });
  return `/api/lobby/stream?${params.toString()}`;
}

export function defaultJoinCode(): string {
  if (typeof window === "undefined") {
    return SEED_EVENT_CODE;
  }
  return window.sessionStorage.getItem(EVENT_STORAGE_KEY) ?? SEED_EVENT_CODE;
}

export function rememberEventCode(code: string): void {
  window.sessionStorage.setItem(EVENT_STORAGE_KEY, code.toUpperCase());
}

export { HOST_USER_ID };
