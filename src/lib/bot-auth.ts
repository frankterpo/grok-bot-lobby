import type { Actor } from "@/lib/domain";
import { ATTENDEE_COOKIE, SLOT_HEADER } from "@/lib/identity";
import { lobbyDispatch } from "@/lib/lobby-client";
import type { StoredEvent } from "@/lib/seed";
import { actorFromRequest } from "@/lib/session";
import { cookies } from "next/headers";

export const BOT_ID_HEADER = "x-lobby-bot-id";
export const EVENT_CODE_HEADER = "x-lobby-event-code";

export async function actorForBridge(
  request: Request,
  eventId?: string,
  code?: string,
): Promise<Actor> {
  const url = new URL(request.url);
  const botId =
    request.headers.get(BOT_ID_HEADER) ?? url.searchParams.get("botId") ?? undefined;
  const eventCode =
    request.headers.get(EVENT_CODE_HEADER) ?? url.searchParams.get("code") ?? code;
  const stored = eventId
    ? await lobbyDispatch<StoredEvent | null>("getStored", { eventId })
    : eventCode
      ? await lobbyDispatch<StoredEvent | null>("getByCode", { code: String(eventCode) })
      : null;

  if (botId) {
    return lobbyDispatch<Actor>("actor", {
      slot: "attendee",
      userId: botId,
      stored,
      hostAuthenticated: false,
    });
  }

  const asAttendee = request.headers.get(SLOT_HEADER) === "attendee" || url.searchParams.get("as") === "attendee";
  if (asAttendee) {
    const jar = await cookies();
    const userId = jar.get(ATTENDEE_COOKIE)?.value ?? null;
    return lobbyDispatch<Actor>("actor", {
      slot: "attendee",
      userId,
      stored,
      hostAuthenticated: false,
    });
  }

  return actorFromRequest(request, eventId, eventCode);
}

export async function actorForClaim(request: Request, eventCode: string): Promise<Actor> {
  const botId = request.headers.get(BOT_ID_HEADER);
  const jar = await cookies();
  const userId = botId ?? jar.get(ATTENDEE_COOKIE)?.value ?? null;
  const stored = await lobbyDispatch("getByCode", { code: eventCode });
  return lobbyDispatch<Actor>("actor", {
    slot: "attendee",
    userId,
    stored,
    hostAuthenticated: false,
  });
}
