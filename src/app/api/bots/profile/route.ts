import type { BotContext } from "@/lib/domain";
import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { fetchPublicProfile } from "@/lib/profile-fetch";
import { parseProfileBody } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseProfileBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId and at least one profile field.", 400);
    }
    const actor = await actorForBridge(request, body.eventId);
    if (!actor.userId) {
      return jsonError("Claim your bot before setting a profile.", 403);
    }
    const context = await lobbyDispatch<BotContext>("context", {
      actor,
      eventId: body.eventId,
      botId: actor.userId,
    });
    const profile = await fetchPublicProfile(actor.userId, body, context.profile);
    await lobbyDispatch("updateProfile", {
      actor,
      eventId: body.eventId,
      profile,
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
