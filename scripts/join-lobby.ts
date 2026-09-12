#!/usr/bin/env node
/**
 * Grok Bot lobby bridge. JSON stdout, grokbot.py style.
 * Claim a bot, sync a task token, heartbeat until SIGINT.
 */

const HEARTBEAT_MS = 30_000;

type ClaimResult = {
  ok?: boolean;
  userId?: string;
  eventId?: string;
  eventCode?: string;
  error?: string;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}

async function postJson(url: string, path: string, body: unknown, botId?: string): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-lobby-as": "attendee",
  };
  if (botId) {
    headers["x-lobby-bot-id"] = botId;
  }
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const err = json as { error?: string };
    fail(err.error ?? `${path} failed (${response.status})`);
  }
  return json;
}

async function main(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const codeArg = arg("code");
  const name = arg("name");
  const color = arg("color") ?? "cyan";
  const task = arg("task");
  const status = arg("status") ?? "working";
  const shareLevel = arg("shareLevel") ?? "label+status";
  const once = hasFlag("once");
  if (!codeArg) {
    fail(
      "Need --code from the host. Example: join-lobby --code ABC123 --url http://127.0.0.1:4521 --name Alice --color cyan",
    );
  }
  const code = codeArg.toUpperCase();
  if (!name) {
    fail(
      "Need --name. Example: join-lobby --code ABC123 --url http://127.0.0.1:4521 --name Alice --color cyan",
    );
  }

  const claimed = (await postJson(url, "/api/bots/claim", {
    eventCode: code,
    name,
    botColor: color,
    hasGrokBot: true,
    acceptPermissions: true,
  })) as ClaimResult;

  const userId = claimed.userId;
  const eventId = claimed.eventId;
  if (!userId || !eventId) {
    fail("Claim did not return userId/eventId.");
  }

  if (task) {
    await postJson(
      url,
      "/api/lobby/sync",
      { eventId, botId: userId, taskLabel: task, status, shareLevel },
      userId,
    );
  }

  await postJson(url, "/api/presence/heartbeat", { eventId, botId: userId }, userId);

  const session = {
    ok: true,
    name,
    userId,
    eventId,
    eventCode: claimed.eventCode ?? code,
    url,
    taskLabel: task ?? null,
    status: task ? status : null,
    shareLevel: task ? shareLevel : null,
    heartbeatMs: HEARTBEAT_MS,
    watching: !once,
  };
  console.log(JSON.stringify(session, null, 2));

  if (once) {
    return;
  }

  const timer = setInterval(() => {
    void postJson(url, "/api/presence/heartbeat", { eventId, botId: userId }, userId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "heartbeat failed";
      console.error(JSON.stringify({ error: message }));
    });
  }, HEARTBEAT_MS);

  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

void main();
