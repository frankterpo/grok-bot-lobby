#!/usr/bin/env node
/**
 * Bridge: fetch lobby bot context (Tier B) for a claimed bot.
 */

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const url = (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
  const eventId = arg("eventId");
  const botId = arg("botId");
  if (!eventId || !botId) {
    console.error(JSON.stringify({ error: "Need --eventId and --botId" }, null, 2));
    process.exit(1);
  }
  const response = await fetch(
    `${url}/api/bots/context?eventId=${encodeURIComponent(eventId)}&botId=${encodeURIComponent(botId)}`,
    {
      headers: {
        "x-lobby-as": "attendee",
        "x-lobby-bot-id": botId,
      },
    },
  );
  const json = await response.json();
  if (!response.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

void main();
