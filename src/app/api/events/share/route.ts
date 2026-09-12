import { originFromRequest } from "@/lib/format";
import { asString, handleError, isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { lobbyDispatch } from "@/lib/lobby-client";
import { actorFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    if (!isRecord(body)) {
      return jsonError("Need eventId.", 400);
    }
    const eventId = asString(body.eventId);
    if (!eventId) {
      return jsonError("Need eventId.", 400);
    }
    const actor = await actorFromRequest(request, eventId);
    await lobbyDispatch("markShareCopied", { actor, eventId });
    return jsonOk(
      await lobbyDispatch("snapshot", {
        eventId,
        actor,
        origin: originFromRequest(request),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
