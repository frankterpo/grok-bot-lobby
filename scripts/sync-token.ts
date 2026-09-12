#!/usr/bin/env node
/** Push a LobbyToken via POST /api/lobby/sync. JSON stdout. */

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

async function main(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const eventId = arg("eventId");
  const botId = arg("botId");
  const task = arg("task");
  const status = arg("status") ?? "working";
  const focus = arg("focus");
  const shareLevel = arg("shareLevel") ?? "label+status";
  if (!eventId || !botId || !task) {
    fail("Need --eventId --botId --task. Optional: --status --focus --shareLevel --url");
  }

  const response = await fetch(`${url}/api/lobby/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lobby-as": "attendee",
      "x-lobby-bot-id": botId,
    },
    body: JSON.stringify({
      eventId,
      botId,
      taskLabel: task,
      status,
      focus,
      shareLevel,
    }),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const err = json as { error?: string };
    fail(err.error ?? `sync failed (${response.status})`);
  }
  console.log(
    JSON.stringify(
      { ok: true, eventId, botId, taskLabel: task, status, shareLevel },
      null,
      2,
    ),
  );
}

void main();
