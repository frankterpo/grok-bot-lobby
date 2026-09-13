import { originFromRequest } from "@/lib/format";
import { actorForBridge } from "@/lib/bot-auth";
import { lobbyStream } from "@/lib/lobby-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return new Response("eventId required", { status: 400 });
  }
  const origin = originFromRequest(request);
  const actor = await actorForBridge(request, eventId);
  return lobbyStream({ eventId, actor, origin });
}
