import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parsePromptBody } from "@/lib/parsers";
import { parseGrokPrompt } from "@/lib/prompt-to-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parsePromptBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId, botId, and prompt.", 400);
    }
    const actor = await actorForBridge(request, body.eventId);
    const intent = parseGrokPrompt(body.prompt);
    await lobbyDispatch("applyPrompt", { actor, input: body });
    return jsonOk({
      ok: true,
      intent,
      snapshot: await lobbyDispatch("snapshot", {
        eventId: body.eventId,
        actor,
        origin: originFromRequest(request),
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
