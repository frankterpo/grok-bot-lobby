import { originFromRequest } from "@/lib/format";
import { handleError, jsonCreated, jsonError, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { getLobby } from "@/lib/lobby-store";
import { parseExchangeProposeBody } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseExchangeProposeBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId, fromBotId, and toBotId or toSquadId.", 400);
    }
    const actor = await actorForBridge(request, body.eventId);
    getLobby().proposeExchange(actor, body);
    return jsonCreated(
      getLobby().snapshot({
        eventId: body.eventId,
        actor,
        origin: originFromRequest(request),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
