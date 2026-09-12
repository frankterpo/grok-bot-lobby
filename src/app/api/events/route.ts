import { originFromRequest } from "@/lib/format";
import { handleError, jsonCreated, jsonError, jsonOk, readJson } from "@/lib/http";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parseEventCreateBody } from "@/lib/parsers";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { actorFromRequest, requireHostActor, writeIdentityCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = clientIp(request);
    const durableLimit = await lobbyDispatch<{ allowed: boolean }>("checkCreateEventRateLimit", { ip });
    if (!durableLimit.allowed || !rateLimit(`create-event:${ip}`, 10, 60_000)) {
      return jsonError("Too many events created. Wait a minute and try again.", 429);
    }

    const body = parseEventCreateBody(await readJson(request));
    if (!body) {
      return jsonError("Need a name and date.", 400);
    }
    const actor = await requireHostActor(request);
    if (actor.userId) {
      await writeIdentityCookie("you", actor.userId);
    }
    const result = await lobbyDispatch("createEvent", {
      actor,
      name: body.name,
      date: body.date,
      origin: originFromRequest(request),
    });
    return jsonCreated(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await actorFromRequest(request);
    const snapshot = await lobbyDispatch("snapshot", {
      actor,
      origin: originFromRequest(request),
    });
    return jsonOk(snapshot);
  } catch (error) {
    return handleError(error);
  }
}
