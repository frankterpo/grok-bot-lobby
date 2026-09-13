#!/usr/bin/env node
/**
 * Loopback sidecar: POST /join spawns join-lobby.ts heartbeat loop.
 * Binds 127.0.0.1:9139 only — never proxies gateway tokens.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const HOST = "127.0.0.1";
const PORT = 9139;
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:4521",
  "https://grok-bot-lobby.teamdeel.workers.dev",
]);

type SidecarJoinRequest = {
  code: string;
  url: string;
  name: string;
  task?: string;
  color?: string;
  shareLevel?: string;
  lumaHandle?: string;
  lumaProfileUrl?: string;
};

type SidecarJoinResponse = {
  ok: boolean;
  userId?: string;
  eventId?: string;
  error?: string;
  pid?: number;
};

type ActiveSession = {
  key: string;
  pid: number;
  userId: string;
  eventId: string;
  child: ChildProcessWithoutNullStreams;
};

const sessions = new Map<string, ActiveSession>();

const joinScript = join(dirname(fileURLToPath(import.meta.url)), "join-lobby.ts");

function sessionKey(code: string, name: string): string {
  return `${code.toUpperCase()}|${name}`;
}

function corsOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }
  if (ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  try {
    const url = new URL(origin);
    if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) {
      return origin;
    }
  } catch {
    // invalid origin
  }
  return null;
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const allowed = corsOrigin(typeof origin === "string" ? origin : undefined);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // HTTPS prod → localhost requires Private Network Access preflight (Chrome 94+).
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  return allowed !== null || !origin;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJoinRequest(raw: string): SidecarJoinRequest | null {
  try {
    const body = JSON.parse(raw) as unknown;
    if (typeof body !== "object" || body === null) {
      return null;
    }
    const record = body as Record<string, unknown>;
    const code = record.code;
    const url = record.url;
    const name = record.name;
    if (typeof code !== "string" || typeof url !== "string" || typeof name !== "string") {
      return null;
    }
    const req: SidecarJoinRequest = { code, url, name };
    if (typeof record.task === "string") {
      req.task = record.task;
    }
    if (typeof record.color === "string") {
      req.color = record.color;
    }
    if (typeof record.shareLevel === "string") {
      req.shareLevel = record.shareLevel;
    }
    if (typeof record.lumaHandle === "string") {
      req.lumaHandle = record.lumaHandle;
    }
    if (typeof record.lumaProfileUrl === "string") {
      req.lumaProfileUrl = record.lumaProfileUrl;
    }
    return req;
  } catch {
    return null;
  }
}

function waitForJoinOutput(child: ChildProcessWithoutNullStreams): Promise<SidecarJoinResponse> {
  return new Promise((resolve) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;

    const finish = (result: SidecarJoinResponse) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.stdout.off("data", onStdout);
      child.stderr.off("data", onStderr);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ ok: false, error: "join-lobby timed out waiting for claim output" });
    }, 30_000);

    const tryParseJson = (buffer: string): SidecarJoinResponse | null => {
      const start = buffer.indexOf("{");
      const end = buffer.indexOf("}", start);
      if (start === -1 || end === -1) {
        return null;
      }
      try {
        const parsed = JSON.parse(buffer.slice(start, end + 1)) as SidecarJoinResponse & { error?: string };
        if (parsed.error) {
          return { ok: false, error: parsed.error };
        }
        if (parsed.ok && parsed.userId && parsed.eventId) {
          return { ok: true, userId: parsed.userId, eventId: parsed.eventId, pid: child.pid ?? undefined };
        }
      } catch {
        return null;
      }
      return null;
    };

    const onStdout = (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const parsed = tryParseJson(stdoutBuffer);
      if (parsed) {
        finish(parsed);
      }
    };

    const onStderr = (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf8");
      const parsed = tryParseJson(stderrBuffer);
      if (parsed && !parsed.ok) {
        finish(parsed);
      }
    };

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("error", (error) => {
      finish({ ok: false, error: error.message });
    });
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        const parsed = tryParseJson(stderrBuffer) ?? tryParseJson(stdoutBuffer);
        finish(parsed ?? { ok: false, error: `join-lobby exited (${code})` });
      }
    });
  });
}

function spawnJoinLoop(req: SidecarJoinRequest): Promise<SidecarJoinResponse> {
  const key = sessionKey(req.code, req.name);
  const args = [
    "--experimental-strip-types",
    "--no-warnings",
    joinScript,
    "--code",
    req.code,
    "--url",
    req.url.replace(/\/$/, ""),
    "--name",
    req.name,
  ];
  if (req.color) {
    args.push("--color", req.color);
  }
  if (req.task) {
    args.push("--task", req.task);
  }
  if (req.shareLevel) {
    args.push("--shareLevel", req.shareLevel);
  }
  if (req.lumaHandle) {
    args.push("--lumaHandle", req.lumaHandle);
  }
  if (req.lumaProfileUrl) {
    args.push("--lumaProfileUrl", req.lumaProfileUrl);
  }

  const child = spawn(process.execPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[join:${key}] ${chunk.toString("utf8")}`);
  });

  return waitForJoinOutput(child).then((result) => {
    if (!result.ok || !result.userId || !result.eventId || !child.pid) {
      child.kill("SIGTERM");
      return result;
    }

    const session: ActiveSession = {
      key,
      pid: child.pid,
      userId: result.userId,
      eventId: result.eventId,
      child,
    };
    sessions.set(key, session);

    child.on("exit", () => {
      const current = sessions.get(key);
      if (current?.pid === child.pid) {
        sessions.delete(key);
      }
    });

    return { ok: true, userId: result.userId, eventId: result.eventId, pid: child.pid };
  });
}

async function handleJoin(req: SidecarJoinRequest, res: ServerResponse): Promise<void> {
  const key = sessionKey(req.code, req.name);
  const existing = sessions.get(key);
  if (existing && existing.child.exitCode === null && !existing.child.killed) {
    sendJson(res, 200, {
      ok: true,
      userId: existing.userId,
      eventId: existing.eventId,
      pid: existing.pid,
    } satisfies SidecarJoinResponse);
    return;
  }

  if (existing) {
    existing.child.kill("SIGTERM");
    sessions.delete(key);
  }

  const result = await spawnJoinLoop(req);
  sendJson(res, result.ok ? 200 : 502, result);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url?.split("?")[0] ?? "/";

  if (req.method === "GET" && path === "/health") {
    sendJson(res, 200, { ok: true, version: VERSION });
    return;
  }

  if (req.method === "POST" && path === "/join") {
    const raw = await readBody(req);
    const body = parseJoinRequest(raw);
    if (!body) {
      sendJson(res, 400, { ok: false, error: "Invalid join body; need code, url, name" } satisfies SidecarJoinResponse);
      return;
    }
    await handleJoin(body, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

const server = createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "internal error";
    sendJson(res, 500, { ok: false, error: message });
  });
});

server.listen(PORT, HOST, () => {
  console.error(JSON.stringify({ ok: true, host: HOST, port: PORT, version: VERSION }));
});

function shutdown(): void {
  for (const session of sessions.values()) {
    session.child.kill("SIGTERM");
  }
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
