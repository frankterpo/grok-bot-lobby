#!/usr/bin/env node
/**
 * Load test: create event, claim 45 bots, sync tokens, heartbeat, verify snapshot.
 * Usage: node --experimental-strip-types scripts/load-test-45.ts --url https://grok-bot-lobby.teamdeel.workers.dev --hostSecret SECRET
 */

const BOT_COUNT = 45;
const COLORS = ["coral", "cyan", "yellow", "orange"] as const;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

async function postJson(
  url: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function main(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const hostSecret = arg("hostSecret") ?? process.env.HOST_SECRET;
  if (!hostSecret) {
    fail("Need --hostSecret or HOST_SECRET env for event creation.");
  }

  const hostHeaders = {
    "x-lobby-as": "you",
    "x-lobby-host-secret": hostSecret,
  };

  const created = await postJson(
    url,
    "/api/events",
    { name: `Load test ${new Date().toISOString()}`, date: new Date().toISOString().slice(0, 10) },
    hostHeaders,
  );
  if (created.status !== 201) {
    fail(`create event failed (${created.status}): ${JSON.stringify(created.json)}`);
  }
  const event = created.json as { event?: { id: string; eventCode: string } };
  const eventId = event.event?.id;
  const eventCode = event.event?.eventCode;
  if (!eventId || !eventCode) {
    fail("create event missing id/code");
  }

  const bots: Array<{ userId: string; name: string }> = [];
  const claimStart = Date.now();

  for (let i = 0; i < BOT_COUNT; i += 1) {
    const name = `Bot-${String(i + 1).padStart(2, "0")}`;
    const color = COLORS[i % COLORS.length];
    const claimed = await postJson(url, "/api/bots/claim", {
      eventCode,
      name,
      botColor: color,
      hasGrokBot: true,
      acceptPermissions: true,
      shareLevel: "label+status",
    });
    if (claimed.status !== 201) {
      fail(`claim ${name} failed (${claimed.status}): ${JSON.stringify(claimed.json)}`);
    }
    const body = claimed.json as { userId?: string };
    if (!body.userId) {
      fail(`claim ${name} missing userId`);
    }
    bots.push({ userId: body.userId, name });
  }

  const claimMs = Date.now() - claimStart;

  for (const bot of bots) {
    const synced = await postJson(
      url,
      "/api/lobby/sync",
      {
        eventId,
        botId: bot.userId,
        taskLabel: `Task for ${bot.name}`,
        status: "working",
      },
      { "x-lobby-as": "attendee", "x-lobby-bot-id": bot.userId },
    );
    if (synced.status !== 200) {
      fail(`sync ${bot.name} failed (${synced.status}): ${JSON.stringify(synced.json)}`);
    }
  }

  for (const bot of bots) {
    const beat = await postJson(
      url,
      "/api/presence/heartbeat",
      { eventId, botId: bot.userId },
      { "x-lobby-as": "attendee", "x-lobby-bot-id": bot.userId },
    );
    if (beat.status !== 200) {
      fail(`heartbeat ${bot.name} failed (${beat.status}): ${JSON.stringify(beat.json)}`);
    }
  }

  const dedup = await postJson(
    url,
    "/api/lobby/sync",
    {
      eventId,
      botId: bots[0].userId,
      taskLabel: `Task for ${bots[0].name}`,
      status: "working",
    },
    { "x-lobby-as": "attendee", "x-lobby-bot-id": bots[0].userId },
  );
  if (dedup.status !== 200) {
    fail(`dedup sync failed (${dedup.status})`);
  }

  const snapshotRes = await fetch(`${url}/api/lobby/snapshot?eventId=${encodeURIComponent(eventId)}`, {
    headers: { "x-lobby-as": "attendee", "x-lobby-bot-id": bots[0].userId },
  });
  const snapshot = (await snapshotRes.json()) as {
    event?: { attendees: unknown[] };
    activeBotCount?: number;
    tokens?: unknown[];
  };

  const attendeeCount = snapshot.event?.attendees.length ?? 0;
  const tokenCount = snapshot.tokens?.length ?? 0;
  const active = snapshot.activeBotCount ?? 0;

  const passed = attendeeCount >= BOT_COUNT + 1 && tokenCount >= BOT_COUNT && active >= BOT_COUNT;

  console.log(
    JSON.stringify(
      {
        ok: passed,
        url,
        eventId,
        eventCode,
        botsClaimed: bots.length,
        claimMs,
        attendeeCount,
        tokenCount,
        activeBotCount: active,
        dedupSyncStatus: dedup.status,
      },
      null,
      2,
    ),
  );

  if (!passed) {
    process.exit(1);
  }
}

void main();
