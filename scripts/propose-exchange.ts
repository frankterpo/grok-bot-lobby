#!/usr/bin/env node
/** Propose a token exchange. JSON stdout. */

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
  const fromBotId = arg("fromBotId");
  const toBotId = arg("toBotId");
  const toSquadId = arg("toSquadId");
  const task = arg("task");
  const status = arg("status") ?? "working";
  if (!eventId || !fromBotId || (!toBotId && !toSquadId)) {
    fail("Need --eventId --fromBotId and --toBotId or --toSquadId.");
  }

  const response = await fetch(`${url}/api/token-exchange/propose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lobby-as": "attendee",
      "x-lobby-bot-id": fromBotId,
    },
    body: JSON.stringify({
      eventId,
      fromBotId,
      toBotId,
      toSquadId,
      taskLabel: task,
      status,
    }),
  });
  const json = (await response.json()) as {
    error?: string;
    exchanges?: Array<{ id: string; status: string; fromBotId: string; toBotId?: string }>;
  };
  if (!response.ok) {
    fail(json.error ?? `propose failed (${response.status})`);
  }
  const pending = (json.exchanges ?? []).filter((item) => item.status === "pending" && item.fromBotId === fromBotId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        eventId,
        fromBotId,
        toBotId: toBotId ?? null,
        toSquadId: toSquadId ?? null,
        latest: pending.at(-1) ?? null,
      },
      null,
      2,
    ),
  );
}

void main();
