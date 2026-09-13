import { originFromRequest } from "@/lib/format";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/http";
import { lobbyDispatch } from "@/lib/lobby-client";
import { parseKickBody } from "@/lib/parsers";
import { requireHostActor } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseKickBody(await readJson(request));
    if (!body) {
      return jsonError("Need eventId and attendeeId.", 400);
    }
    const actor = await requireHostActor(request, body.eventId);
    await lobbyDispatch("kickAttendee", {
      actor,
      eventId: body.eventId,
      attendeeId: body.attendeeId,
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
