import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parseHeartbeatBody } from "@/lib/parsers";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseHeartbeatBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId and botId.", 400);
    }
    const ip = clientIp(request);
    const durableLimit = await lobbyDispatch<{ allowed: boolean }>("checkHeartbeatRateLimit", {
      ip,
      botId: body.botId,
    });
    if (!durableLimit.allowed || !rateLimit(`heartbeat:ip:${ip}`, 150, 60_000)) {
      return jsonError("Too many heartbeats. Slow down.", 429);
    }
    const actor = await actorForBridge(request, body.eventId);
    await lobbyDispatch("heartbeat", { actor, eventId: body.eventId, botId: body.botId });
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
