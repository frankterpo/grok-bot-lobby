import { cookies } from "next/headers";

import {
  HOST_USER_ID,
  isIdentitySlot,
  type Actor,
  type IdentitySlot,
} from "@/lib/domain";
import { ATTENDEE_COOKIE, HOST_COOKIE, SLOT_HEADER } from "@/lib/identity";
import { getLobby } from "@/lib/lobby-store";

export { ATTENDEE_COOKIE, HOST_COOKIE, SLOT_HEADER };

export function parseSlot(value: string | null): IdentitySlot {
  if (value && isIdentitySlot(value)) {
    return value;
  }
  return "you";
}

export function slotFromRequest(request: Request): IdentitySlot {
  const url = new URL(request.url);
  return parseSlot(request.headers.get(SLOT_HEADER) ?? url.searchParams.get("as"));
}

export async function userIdForSlot(slot: IdentitySlot): Promise<string | null> {
  const jar = await cookies();
  if (slot === "you") {
    return jar.get(HOST_COOKIE)?.value ?? HOST_USER_ID;
  }
  return jar.get(ATTENDEE_COOKIE)?.value ?? null;
}

export async function actorFromRequest(
  request: Request,
  eventId?: string,
  code?: string,
): Promise<Actor> {
  const slot = slotFromRequest(request);
  const userId = await userIdForSlot(slot);
  const lobby = getLobby();
  const stored = eventId
    ? lobby.getStored(eventId)
    : code
      ? lobby.getByCode(code)
      : lobby.listEvents().length === 1
        ? lobby.getStored(lobby.listEvents()[0]!.id)
        : null;
  return lobby.actor(slot, userId, stored);
}

export async function writeIdentityCookie(slot: IdentitySlot, userId: string): Promise<void> {
  const jar = await cookies();
  const name = slot === "you" ? HOST_COOKIE : ATTENDEE_COOKIE;
  jar.set(name, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function cookieSetter(slot: IdentitySlot, userId: string): string {
  const name = slot === "you" ? HOST_COOKIE : ATTENDEE_COOKIE;
  return `${name}=${userId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly`;
}
