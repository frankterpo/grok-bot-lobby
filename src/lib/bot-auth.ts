import type { Actor } from "@/lib/domain";
import { ATTENDEE_COOKIE, SLOT_HEADER } from "@/lib/identity";
import { getLobby } from "@/lib/lobby-store";
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
  const lobby = getLobby();
  const stored = eventId
    ? lobby.getStored(eventId)
    : eventCode
      ? lobby.getByCode(eventCode)
      : lobby.getStored("event_coloop");

  if (botId) {
    return lobby.actor("attendee", botId, stored);
  }

  const asAttendee = request.headers.get(SLOT_HEADER) === "attendee" || url.searchParams.get("as") === "attendee";
  if (asAttendee) {
    const jar = await cookies();
    const userId = jar.get(ATTENDEE_COOKIE)?.value ?? null;
    return lobby.actor("attendee", userId, stored);
  }

  return actorFromRequest(request, eventId, eventCode);
}

export async function actorForClaim(request: Request, eventCode: string): Promise<Actor> {
  const botId = request.headers.get(BOT_ID_HEADER);
  const jar = await cookies();
  const userId = botId ?? jar.get(ATTENDEE_COOKIE)?.value ?? null;
  const stored = getLobby().getByCode(eventCode);
  return getLobby().actor("attendee", userId, stored);
}
