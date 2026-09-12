import { originFromRequest } from "@/lib/format";
import { handleError, jsonCreated, jsonError, jsonOk, readJson } from "@/lib/http";
import { getLobby } from "@/lib/lobby-store";
import { parseEventCreateBody } from "@/lib/parsers";
import { actorFromRequest, writeIdentityCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseEventCreateBody(await readJson(request));
    if (!body) {
      return jsonError("Need a name and date.", 400);
    }
    const actor = await actorFromRequest(request);
    if (actor.userId) {
      await writeIdentityCookie("you", actor.userId);
    }
    const result = getLobby().createEvent(actor, body.name, body.date, originFromRequest(request));
    return jsonCreated(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await actorFromRequest(request);
    return jsonOk(getLobby().snapshot({ actor, origin: originFromRequest(request) }));
  } catch (error) {
    return handleError(error);
  }
}
