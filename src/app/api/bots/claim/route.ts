import type { LobbySnapshot } from "@/lib/domain";
import { originFromRequest } from "@/lib/format";
import { handleError, jsonCreated, jsonError, readJson } from "@/lib/http";
import { actorForClaim } from "@/lib/bot-auth";
import { lobbyDispatch } from "@/lib/lobby-client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseClaimBody } from "@/lib/parsers";
import { writeIdentityCookie } from "@/lib/session";

type ClaimResult = { snapshot: LobbySnapshot; userId: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = clientIp(request);
    const durableLimit = await lobbyDispatch<{ allowed: boolean }>("checkClaimRateLimit", { ip });
    if (!durableLimit.allowed || !rateLimit(`claim:${ip}`, 60, 60_000)) {
      return jsonError("Too many join attempts. Wait a minute and try again.", 429);
    }

    const body = parseClaimBody(await readJson(request));
    if (!body) {
      return jsonError("Need event code, name, and color.", 400);
    }
    const actor = await actorForClaim(request, body.eventCode);
    const result = await lobbyDispatch<ClaimResult>("claim", {
      actor,
      input: body,
      origin: originFromRequest(request),
    });
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
