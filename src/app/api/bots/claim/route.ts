import { originFromRequest } from "@/lib/format";
import { handleError, jsonCreated, jsonError, readJson } from "@/lib/http";
import { actorForClaim } from "@/lib/bot-auth";
import { getLobby } from "@/lib/lobby-store";
import { parseClaimBody } from "@/lib/parsers";
import { writeIdentityCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseClaimBody(await readJson(request));
    if (!body) {
      return jsonError("Need event code, name, and color.", 400);
    }
    const actor = await actorForClaim(request, body.eventCode);
    const result = getLobby().claim(actor, body, originFromRequest(request));
    await writeIdentityCookie("attendee", result.userId);
    return jsonCreated({
      ok: true,
      userId: result.userId,
      eventId: result.snapshot.event?.id ?? null,
      eventCode: result.snapshot.event?.eventCode ?? body.eventCode,
      snapshot: result.snapshot,
    });
  } catch (error) {
    return handleError(error);
  }
}
