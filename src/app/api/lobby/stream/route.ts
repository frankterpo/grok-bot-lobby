import { originFromRequest } from "@/lib/format";
import { actorFromRequest } from "@/lib/session";
import { getLobby } from "@/lib/lobby-store";
import type { LobbySnapshot } from "@/lib/domain";

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
  const lobby = getLobby();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let unsubscribe = (): void => {};
      const send = (snapshot: LobbySnapshot) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          unsubscribe();
        }
      };
      send(lobby.snapshot({ eventId, actor, origin }));
      unsubscribe = lobby.subscribe(eventId, actor, origin, send);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          unsubscribe();
        }
      }, 15_000);
      const stop = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
