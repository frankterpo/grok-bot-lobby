import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { getLobby } from "@/lib/lobby-store";
import { parseExchangeResolveBody } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseExchangeResolveBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId and requestId.", 400);
    }
    const actor = await actorForBridge(request, body.eventId);
    getLobby().resolveExchange(actor, body.eventId, body.requestId, "rejected");
    return jsonOk(
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
