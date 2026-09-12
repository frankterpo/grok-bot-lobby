#!/usr/bin/env node
/**
 * Load test: join 45 bots to one lobby, sync tokens, heartbeat once.
 * Usage: npm run load-test-45 -- --url https://grok-bot-lobby.teamdeel.workers.dev --code CODE
 */

type ClaimResult = {
  ok?: boolean;
  userId?: string;
  eventId?: string;
  error?: string;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
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
    throw new Error(err.error ?? `${path} failed (${response.status})`);
  }
  return json;
}

async function joinOne(baseUrl: string, code: string, index: number): Promise<{ userId: string; eventId: string }> {
  const claimed = (await postJson(baseUrl, "/api/bots/claim", {
    eventCode: code,
    name: `Bot-${String(index).padStart(2, "0")}`,
    botColor: ["coral", "cyan", "yellow", "orange"][index % 4],
    hasGrokBot: true,
    acceptPermissions: true,
    shareLevel: "label+status",
  })) as ClaimResult;
  const userId = claimed.userId;
  const eventId = claimed.eventId;
  if (!userId || !eventId) {
    throw new Error(`Bot ${index}: claim missing userId/eventId`);
  }
  await postJson(
    baseUrl,
    "/api/lobby/sync",
    {
      eventId,
      botId: userId,
      taskLabel: `Load test task ${index}`,
      status: index % 3 === 0 ? "working" : "idle",
      shareLevel: "label+status",
    },
    userId,
  );
  await postJson(baseUrl, "/api/presence/heartbeat", { eventId, botId: userId }, userId);
  return { userId, eventId };
}

async function main(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const code = arg("code")?.toUpperCase();
  const count = Number(arg("count") ?? "45");
  if (!code) {
    console.error(JSON.stringify({ error: "Need --code from host event" }, null, 2));
    process.exit(1);
  }

  const started = Date.now();
  const results: Array<{ index: number; userId: string; ok: boolean; error?: string }> = [];
  const batchSize = 5;

  for (let start = 1; start <= count; start += batchSize) {
    const end = Math.min(start + batchSize - 1, count);
    const batch = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, offset) => {
        const index = start + offset;
        return joinOne(url, code, index)
          .then((result) => ({ index, userId: result.userId, ok: true as const }))
          .catch((error: unknown) => ({
            index,
            userId: "",
            ok: false as const,
            error: error instanceof Error ? error.message : "join failed",
          }));
      }),
    );
    results.push(...batch);
  }

  const ok = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  const elapsedMs = Date.now() - started;

  const summary = {
    ok: failed.length === 0,
    url,
    code,
    requested: count,
    joined: ok,
    failed: failed.length,
    elapsedMs,
    failures: failed.slice(0, 10),
    sampleUserIds: results.filter((item) => item.ok).slice(0, 5).map((item) => item.userId),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
