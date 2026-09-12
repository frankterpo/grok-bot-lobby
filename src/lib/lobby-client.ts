import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { LobbyStoreDO } from "@/durable-objects/lobby-store-do";
import type { Actor } from "@/lib/domain";
import { getLobby, type LobbyMemory } from "@/lib/lobby-store";

const STORE_NAME = "primary";

export type LobbyStoreBinding = DurableObjectNamespace<LobbyStoreDO>;

export function lobbyStoreForcedMemory(): boolean {
  return process.env.LOBBY_STORE === "memory";
}

export async function getLobbyStoreBinding(): Promise<LobbyStoreBinding | null> {
  if (lobbyStoreForcedMemory()) {
    return null;
  }
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.LOBBY_STORE ?? null;
  } catch {
    return null;
  }
}

async function stub() {
  const binding = await getLobbyStoreBinding();
  if (!binding) {
    return null;
  }
  return binding.getByName(STORE_NAME);
}

export async function lobbyDispatch<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const room = await stub();
  if (!room) {
    const lobby = getLobby();
    switch (op) {
      case "snapshot":
        return lobby.snapshot(payload as Parameters<LobbyMemory["snapshot"]>[0]) as T;
      case "createEvent":
        return lobby.createEvent(
          payload.actor as Parameters<LobbyMemory["createEvent"]>[0],
          payload.name as string,
          payload.date as string,
          payload.origin as string,
        ) as T;
      case "markShareCopied":
        return lobby.markShareCopied(
          payload.actor as Parameters<LobbyMemory["markShareCopied"]>[0],
          payload.eventId as string,
        ) as T;
      case "claim":
        return (await lobby.claim(
          payload.actor as Parameters<LobbyMemory["claim"]>[0],
          payload.input as Parameters<LobbyMemory["claim"]>[1],
          payload.origin as string,
        )) as T;
      case "updateProfile":
        return (await lobby.updateProfile(
          payload.actor as Parameters<LobbyMemory["updateProfile"]>[0],
          payload.input as Parameters<LobbyMemory["updateProfile"]>[1],
        )) as T;
      case "sync":
        return lobby.sync(
          payload.actor as Parameters<LobbyMemory["sync"]>[0],
          payload.input as Parameters<LobbyMemory["sync"]>[1],
        ) as T;
      case "heartbeat":
        return lobby.heartbeat(
          payload.actor as Parameters<LobbyMemory["heartbeat"]>[0],
          payload.eventId as string,
          payload.botId as string,
        ) as T;
      case "invite":
        return lobby.invite(
          payload.actor as Parameters<LobbyMemory["invite"]>[0],
          payload.eventId as string,
          payload.attendeeId as string,
          payload.squadId as string | undefined,
        ) as T;
      case "requestJoin":
        return lobby.requestJoin(
          payload.actor as Parameters<LobbyMemory["requestJoin"]>[0],
          payload.eventId as string,
          payload.squadId as string,
        ) as T;
      case "leaveSquad":
        return lobby.leaveSquad(
          payload.actor as Parameters<LobbyMemory["leaveSquad"]>[0],
          payload.eventId as string,
          payload.squadId as string | undefined,
        ) as T;
      case "proposeExchange":
        return lobby.proposeExchange(
          payload.actor as Parameters<LobbyMemory["proposeExchange"]>[0],
          payload.input as Parameters<LobbyMemory["proposeExchange"]>[1],
        ) as T;
      case "resolveExchange":
        return lobby.resolveExchange(
          payload.actor as Parameters<LobbyMemory["resolveExchange"]>[0],
          payload.eventId as string,
          payload.requestId as string,
          payload.status as Parameters<LobbyMemory["resolveExchange"]>[3],
        ) as T;
      case "context":
        return lobby.context(
          payload.actor as Parameters<LobbyMemory["context"]>[0],
          payload.eventId as string,
          payload.botId as string,
        ) as T;
      case "updatePrefs":
        return lobby.updatePrefs(
          payload.actor as Parameters<LobbyMemory["updatePrefs"]>[0],
          payload.input as Parameters<LobbyMemory["updatePrefs"]>[1],
          payload.eventId as string,
        ) as T;
      case "getStored":
        return lobby.getStored(payload.eventId as string) as T;
      case "getByCode":
        return lobby.getByCode(payload.code as string) as T;
      case "actor":
        return lobby.actor(
          {
            slot: payload.slot as Actor["slot"],
            userId: (payload.userId as string | null) ?? null,
            role: "guest",
            hostAuthenticated: payload.hostAuthenticated === true,
          },
          payload.stored as Parameters<LobbyMemory["actor"]>[1],
        ) as T;
      case "checkClaimRateLimit":
      case "checkSyncRateLimit":
      case "checkHeartbeatRateLimit":
      case "checkCreateEventRateLimit":
        return { allowed: true } as T;
      default:
        throw new Error(`Unknown lobby operation: ${op}`);
    }
  }

  const result = await room.dispatch(op, payload);
  if (!op.startsWith("check")) {
    await room.commit();
  }
  return result as T;
}

export async function lobbyStream(args: {
  eventId: string;
  actor: Parameters<LobbyMemory["snapshot"]>[0]["actor"];
  origin: string;
}): Promise<Response> {
  const room = await stub();
  if (!room) {
    const lobby = getLobby();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let unsubscribe = (): void => {};
        const send = (snapshot: Parameters<typeof JSON.stringify>[0]) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
          } catch {
            unsubscribe();
          }
        };
        send(lobby.snapshot({ eventId: args.eventId, actor: args.actor, origin: args.origin }));
        unsubscribe = lobby.subscribe(args.eventId, args.actor, args.origin, send);
        const ping = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            unsubscribe();
          }
        }, 15_000);
        return () => {
          clearInterval(ping);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
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
  return room.stream(args);
}
