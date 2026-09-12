import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk } from "@/lib/http";
import { lobbyDispatch } from "@/lib/lobby-client";
import type { LobbySnapshot } from "@/lib/domain";
import { actorFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? undefined;
    const code = url.searchParams.get("code") ?? undefined;
    if (!eventId && !code) {
      return jsonError("Need eventId or code.", 400);
    }
    const actor = await actorFromRequest(request, eventId, code);
    const snapshot = await lobbyDispatch<LobbySnapshot>("snapshot", {
      eventId,
      code,
      actor,
      origin: originFromRequest(request),
    });
    if (!snapshot.event) {
      return jsonError("No lobby with that id or code.", 404);
    }
    return jsonOk({
      ok: true,
      eventId: snapshot.event.id,
      eventCode: snapshot.event.eventCode,
      count: snapshot.event.attendees.length,
      activeBotCount: snapshot.activeBotCount,
      bots: snapshot.event.attendees,
      presence: snapshot.presence,
      tokens: snapshot.tokens,
    });
  } catch (error) {
    return handleError(error);
  }
}
