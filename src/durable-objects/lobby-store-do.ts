import { DurableObject } from "cloudflare:workers";

import type { Actor, ExchangeStatus, LobbySnapshot, ShareLevel, TokenStatus } from "@/lib/domain";
import { LobbyMemory, LobbyError } from "@/lib/lobby-store";
import type { PersistedLobbyState } from "@/lib/lobby-persisted";
import { emptyPersistedState } from "@/lib/lobby-persisted";

const STATE_KEY = "lobby-state";

export type LobbyStoreEnv = {
  LOBBY_STORE: DurableObjectNamespace<LobbyStoreDO>;
  SEED_DEMO?: string;
};

type SnapshotListener = {
  actor: Actor;
  origin: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

export class LobbyStoreDO extends DurableObject<LobbyStoreEnv> {
  private lobby: LobbyMemory | null = null;
  private listeners = new Map<string, Set<SnapshotListener>>();
  private loaded = false;

  private async ensureLoaded(): Promise<LobbyMemory> {
    if (this.lobby && this.loaded) {
      return this.lobby;
    }
    const stored = await this.ctx.storage.get<PersistedLobbyState>(STATE_KEY);
    if (stored) {
      this.lobby = LobbyMemory.fromPersisted(stored);
    } else if (this.env.SEED_DEMO === "1") {
      this.lobby = new LobbyMemory();
    } else {
      this.lobby = LobbyMemory.fromPersisted(emptyPersistedState());
    }
    this.loaded = true;
    return this.lobby;
  }

  private async persist(): Promise<void> {
    if (!this.lobby) {
      return;
    }
    await this.ctx.storage.put(STATE_KEY, this.lobby.toPersisted());
  }

  private attachEmitter(lobby: LobbyMemory): void {
    lobby.setEmitter((eventId) => {
      const bucket = this.listeners.get(eventId);
      if (!bucket) {
        return;
      }
      for (const listener of bucket) {
        const snapshot = lobby.snapshot({
          eventId,
          actor: listener.actor,
          origin: listener.origin,
        });
        const payload = new TextEncoder().encode(`data: ${JSON.stringify(snapshot)}\n\n`);
        void listener.writer.write(payload).catch(() => {
          bucket.delete(listener);
        });
      }
    });
  }

  async dispatch(op: string, payload: Record<string, unknown>): Promise<unknown> {
    const lobby = await this.ensureLoaded();
    this.attachEmitter(lobby);

    switch (op) {
      case "snapshot":
        return lobby.snapshot(payload as Parameters<LobbyMemory["snapshot"]>[0]);
      case "createEvent":
        return lobby.createEvent(
          payload.actor as Actor,
          payload.name as string,
          payload.date as string,
          payload.origin as string,
        );
      case "markShareCopied":
        return lobby.markShareCopied(payload.actor as Actor, payload.eventId as string);
      case "claim":
        return await lobby.claim(
          payload.actor as Actor,
          payload.input as Parameters<LobbyMemory["claim"]>[1],
          payload.origin as string,
        );
      case "sync":
        return lobby.sync(payload.actor as Actor, payload.input as Parameters<LobbyMemory["sync"]>[1]);
      case "heartbeat":
        return lobby.heartbeat(payload.actor as Actor, payload.eventId as string, payload.botId as string);
      case "invite":
        return lobby.invite(
          payload.actor as Actor,
          payload.eventId as string,
          payload.attendeeId as string,
          payload.squadId as string | undefined,
        );
      case "requestJoin":
        return lobby.requestJoin(payload.actor as Actor, payload.eventId as string, payload.squadId as string);
      case "leaveSquad":
        return lobby.leaveSquad(
          payload.actor as Actor,
          payload.eventId as string,
          payload.squadId as string | undefined,
        );
      case "proposeExchange":
        return lobby.proposeExchange(payload.actor as Actor, payload.input as Parameters<LobbyMemory["proposeExchange"]>[1]);
      case "resolveExchange":
        return lobby.resolveExchange(
          payload.actor as Actor,
          payload.eventId as string,
          payload.requestId as string,
          payload.status as ExchangeStatus,
        );
      case "context":
        return lobby.context(payload.actor as Actor, payload.eventId as string, payload.botId as string);
      case "updatePrefs":
        return lobby.updatePrefs(
          payload.actor as Actor,
          payload.input as {
            shareLevel?: ShareLevel;
            shareTokens?: boolean;
            permissionsAccepted?: boolean;
            hasGrokBot?: boolean;
          },
          payload.eventId as string,
        );
      case "getStored":
        return lobby.getStored(payload.eventId as string);
      case "getByCode":
        return lobby.getByCode(payload.code as string);
      case "actor":
        return lobby.actor(
          {
            slot: payload.slot as Actor["slot"],
            userId: (payload.userId as string | null) ?? null,
            role: "guest",
            hostAuthenticated: payload.hostAuthenticated === true,
          },
          payload.stored as Parameters<LobbyMemory["actor"]>[1],
        );
      case "updateProfile":
        return await lobby.updateProfile(
          payload.actor as Actor,
          payload.input as Parameters<LobbyMemory["updateProfile"]>[1],
        );
      case "checkClaimRateLimit": {
        const ip = payload.ip as string;
        const allowed = await this.checkRateLimit(`claim:${ip}`, 20, 60_000);
        return { allowed };
      }
      case "checkSyncRateLimit": {
        const botId = payload.botId as string;
        const allowed = await this.checkRateLimit(`sync:${botId}`, 120, 60_000);
        return { allowed };
      }
      case "checkHeartbeatRateLimit": {
        const botId = payload.botId as string;
        const allowed = await this.checkRateLimit(`heartbeat:${botId}`, 120, 60_000);
        return { allowed };
      }
      case "checkCreateEventRateLimit": {
        const ip = payload.ip as string;
        const allowed = await this.checkRateLimit(`create-event:${ip}`, 10, 60_000);
        return { allowed };
      }
      default:
        throw new LobbyError(`Unknown lobby operation: ${op}`, 400);
    }
  }

  private async checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const record = (await this.ctx.storage.get<{ count: number; resetAt: number }>(`rl:${key}`)) ?? {
      count: 0,
      resetAt: now + windowMs,
    };
    if (now >= record.resetAt) {
      await this.ctx.storage.put(`rl:${key}`, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count >= limit) {
      return false;
    }
    await this.ctx.storage.put(`rl:${key}`, { count: record.count + 1, resetAt: record.resetAt });
    return true;
  }

  async commit(): Promise<void> {
    await this.persist();
  }

  async stream(args: {
    eventId: string;
    actor: Actor;
    origin: string;
  }): Promise<Response> {
    const lobby = await this.ensureLoaded();
    this.attachEmitter(lobby);
    const encoder = new TextEncoder();
    let closed = false;

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const listener: SnapshotListener = {
      actor: args.actor,
      origin: args.origin,
      writer,
    };
    const bucket = this.listeners.get(args.eventId) ?? new Set<SnapshotListener>();
    bucket.add(listener);
    this.listeners.set(args.eventId, bucket);

    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      bucket.delete(listener);
      void writer.close().catch(() => undefined);
    };

    void writer.write(
      encoder.encode(`data: ${JSON.stringify(lobby.snapshot({ eventId: args.eventId, actor: args.actor, origin: args.origin }))}\n\n`),
    );

    const ping = setInterval(() => {
      if (closed) {
        clearInterval(ping);
        return;
      }
      void writer.write(encoder.encode(`: ping\n\n`)).catch(cleanup);
    }, 15_000);

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
