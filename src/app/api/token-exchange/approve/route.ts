import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
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
    await lobbyDispatch("resolveExchange", {
      actor,
      eventId: body.eventId,
      requestId: body.requestId,
      status: "approved",
    });
    return jsonOk(
      await lobbyDispatch("snapshot", {
        eventId: body.eventId,
        actor,
        origin: originFromRequest(request),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
