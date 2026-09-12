import { jsonError, jsonOk, handleError } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { getLobby } from "@/lib/lobby-store";

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
    return jsonOk(getLobby().context(actor, eventId, botId));
  } catch (error) {
    return handleError(error);
  }
}
