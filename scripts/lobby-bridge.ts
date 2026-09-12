#!/usr/bin/env node
/**
 * Grok Bot Lobby ↔ grok-bot-skill bridge CLI. JSON stdout.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}

function grokbotScript(): string {
  const home = process.env.HOME ?? "";
  const candidates = [
    join(home, ".cursor/skills/grok-bot/scripts/grokbot.py"),
    join(home, ".agents/skills/grok-bot/scripts/grokbot.py"),
  ];
  for (const path of candidates) {
    try {
      readFileSync(path);
      return path;
    } catch {
      // try next
    }
  }
  fail("grok-bot-skill not installed. Run: npx skills add adamanz/grok-bot-skill -g -a cursor");
}

async function lobbyGet(url: string, path: string, botId?: string): Promise<unknown> {
  const headers: Record<string, string> = { "x-lobby-as": "attendee" };
  if (botId) {
    headers["x-lobby-bot-id"] = botId;
  }
  const response = await fetch(`${url}${path}`, { headers });
  const json: unknown = await response.json();
  if (!response.ok) {
    const err = json as { error?: string };
    fail(err.error ?? `${path} failed (${response.status})`);
  }
  return json;
}

async function cmdListBots(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const eventId = arg("eventId");
  const botId = arg("botId");
  if (!eventId) {
    fail("Need --eventId");
  }
  const snapshot = (await lobbyGet(
    url,
    `/api/lobby/snapshot?eventId=${encodeURIComponent(eventId)}`,
    botId,
  )) as {
    event?: { attendees: Array<{ id: string; name: string; botTaskLabel?: string }> };
    tokens?: Array<{ botId: string; taskLabel: string; status: string }>;
    activeBotCount?: number;
  };
  const tokensByBot = new Map((snapshot.tokens ?? []).map((t) => [t.botId, t]));
  const bots = (snapshot.event?.attendees ?? []).map((attendee) => ({
    id: attendee.id,
    name: attendee.name,
    taskLabel: tokensByBot.get(attendee.id)?.taskLabel ?? attendee.botTaskLabel ?? null,
    status: tokensByBot.get(attendee.id)?.status ?? null,
  }));
  console.log(JSON.stringify({ ok: true, eventId, activeBotCount: snapshot.activeBotCount ?? 0, bots }, null, 2));
}

async function cmdContextFromBot(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const eventId = arg("eventId");
  const botId = arg("botId");
  if (!eventId || !botId) {
    fail("Need --eventId and --botId");
  }
  const context = await lobbyGet(
    url,
    `/api/bots/context?eventId=${encodeURIComponent(eventId)}&botId=${encodeURIComponent(botId)}`,
    botId,
  );
  console.log(JSON.stringify({ ok: true, context }, null, 2));
}

function cmdStandingRules(): void {
  const path = join(process.cwd(), "docs/grok-bot-standing-rules.md");
  const text = readFileSync(path, "utf8");
  const marker = "---\n";
  const body = text.includes(marker) ? text.slice(text.indexOf(marker) + marker.length).trim() : text.trim();
  console.log(JSON.stringify({ ok: true, path, rules: body }, null, 2));
}

function cmdTranscribeHook(): void {
  const name = arg("name");
  const limit = arg("limit") ?? "5";
  const taskPrefix = arg("taskPrefix") ?? "Lobby sync:";
  if (!name) {
    fail("Need --name (Grok Bot teammate name)");
  }
  const script = grokbotScript();
  const result = spawnSync("python3", [script, "transcript", "--name", name, "--limit", limit], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(result.stderr || "transcript failed");
  }
  let payload: { entries?: Array<{ text?: string }> };
  try {
    payload = JSON.parse(result.stdout) as typeof payload;
  } catch {
    fail("transcript returned non-JSON");
  }
  const last = [...(payload.entries ?? [])].reverse().find((e) => e.text?.trim());
  const summary = last?.text?.trim().slice(0, 80) ?? `${taskPrefix} idle`;
  console.log(
    JSON.stringify(
      {
        ok: true,
        tier: "B",
        suggestedTaskLabel: summary.startsWith(taskPrefix) ? summary : `${taskPrefix} ${summary}`.slice(0, 80),
        entryCount: payload.entries?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case "list-bots":
      await cmdListBots();
      break;
    case "context-from-bot":
      await cmdContextFromBot();
      break;
    case "standing-rules":
      cmdStandingRules();
      break;
    case "transcribe-hook":
      cmdTranscribeHook();
      break;
    default:
      fail("Usage: lobby-bridge <list-bots|context-from-bot|standing-rules|transcribe-hook> [options]");
  }
}

void main();
