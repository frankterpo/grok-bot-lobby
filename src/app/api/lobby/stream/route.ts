import { originFromRequest } from "@/lib/format";
import { lobbyStream } from "@/lib/lobby-client";
import { actorFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return new Response("eventId required", { status: 400 });
  }
  const origin = originFromRequest(request);
  const actor = await actorFromRequest(request, eventId);
  return lobbyStream({ eventId, actor, origin });
}
