import { originFromRequest } from "@/lib/format";
import { handleError, jsonOk } from "@/lib/http";
import { lobbyDispatch } from "@/lib/lobby-client";
import { actorFromRequest, writeIdentityCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? undefined;
    const code = url.searchParams.get("code") ?? undefined;
    const actor = await actorFromRequest(request, eventId, code);
    if (actor.hostAuthenticated && actor.slot === "you" && actor.userId) {
      await writeIdentityCookie("you", actor.userId);
    }
    const snapshot = await lobbyDispatch("snapshot", {
      eventId,
      code,
      actor,
      origin: originFromRequest(request),
    });
    return jsonOk(snapshot);
  } catch (error) {
    return handleError(error);
  }
}
