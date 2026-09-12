import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parseEnrichBody } from "@/lib/parsers";
import { resolvePublicProfile } from "@/lib/profile-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseEnrichBody(await readJson(request));
    if (!body) {
      return jsonError("Need at least one profile URL or handle.", 400);
    }
    const userId = body.botId ?? body.userId ?? "preview";
    const profile = await resolvePublicProfile(userId, body);
    if (body.eventId && body.botId) {
      const actor = await actorForBridge(request, body.eventId);
      await lobbyDispatch("updateProfile", { actor, input: body });
    }
    return jsonOk({
      ok: true,
      profile,
      persisted: Boolean(body.eventId && body.botId),
      snapshot: body.eventId
        ? await lobbyDispatch("snapshot", {
            eventId: body.eventId,
            actor: await actorForBridge(request, body.eventId),
            origin: originFromRequest(request),
          })
        : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
