import { jsonError, jsonOk, handleError } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const botId = url.searchParams.get("botId");
    const eventId = url.searchParams.get("eventId");
    if (!botId || !eventId) {
      return jsonError("botId and eventId are required.", 400);
    }
    const actor = await actorForBridge(request, eventId);
    return jsonOk(await lobbyDispatch("context", { actor, eventId, botId }));
  } catch (error) {
    return handleError(error);
  }
}
