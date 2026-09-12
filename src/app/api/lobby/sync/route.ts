import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parseSyncBody } from "@/lib/parsers";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseSyncBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId, botId, taskLabel, and status.", 400);
    }
    const ip = clientIp(request);
    const durableLimit = await lobbyDispatch<{ allowed: boolean }>("checkSyncRateLimit", { botId: body.botId });
    if (!durableLimit.allowed || !rateLimit(`sync:${body.botId}:${ip}`, 120, 60_000)) {
      return jsonError("Too many token syncs. Wait a minute and try again.", 429);
    }
    const actor = await actorForBridge(request, body.eventId);
    await lobbyDispatch("sync", { actor, input: body });
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
