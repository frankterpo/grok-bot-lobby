#!/usr/bin/env node
/**
 * Grok Bot community CLI — join, invite, leave, propose, prompt, kick, enrich.
 * JSON stdout for grokbot.py / standing rules.
 */

type Json = Record<string, unknown>;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function command(): string {
  const raw = process.argv[2];
  if (!raw || raw.startsWith("--")) {
    return "help";
  }
  return raw;
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}

function baseUrl(): string {
  return (arg("url") ?? "http://127.0.0.1:4521").replace(/\/$/, "");
}

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Json }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lobby-as": "attendee",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const json = ((await response.json()) as Json) ?? {};
  if (!response.ok) {
    fail(typeof json.error === "string" ? json.error : `${path} failed (${response.status})`);
  }
  return { status: response.status, json };
}

async function del(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Json> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-lobby-as": "you",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const json = ((await response.json()) as Json) ?? {};
  if (!response.ok) {
    fail(typeof json.error === "string" ? json.error : `${path} failed (${response.status})`);
  }
  return json;
}

function botHeaders(botId?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (botId) {
    headers["x-lobby-bot-id"] = botId;
  }
  const hostSecret = arg("hostSecret") ?? process.env.HOST_SECRET;
  if (hostSecret) {
    headers["x-lobby-host-secret"] = hostSecret;
    headers["x-lobby-as"] = "you";
  }
  return headers;
}

function help(): void {
  console.log(
    JSON.stringify(
      {
        ok: true,
        usage: "npm run grok-community -- <command> [flags]",
        commands: {
          join: "--code CODE --name NAME [--task TASK] [--color cyan]",
          invite: "--eventId ID --botId YOU --attendeeId THEM [--squadId ID]",
          request: "--eventId ID --botId YOU --squadId ID",
          respond: "--eventId ID --botId YOU --inviteId ID --status accepted|rejected",
          leave: "--eventId ID --botId YOU [--squadId ID]",
          propose: "--eventId ID --fromBotId YOU --toBotId ID|--toSquadId ID [--task LABEL]",
          prompt: "--eventId ID --botId YOU --prompt \"I'm working on the deck\"",
          kick: "--eventId ID --attendeeId THEM --hostSecret SECRET",
          enrich: "--lumaHandle HANDLE [--botId ID --eventId ID]",
          list: "--eventId ID [--botId YOU]",
        },
      },
      null,
      2,
    ),
  );
}

async function join(): Promise<void> {
  const code = arg("code");
  const name = arg("name");
  if (!code || !name) {
    fail("join needs --code and --name.");
  }
  const { json } = await post("/api/bots/claim", {
    eventCode: code.toUpperCase(),
    name,
    botColor: arg("color") ?? "cyan",
    hasGrokBot: true,
    acceptPermissions: true,
    shareLevel: arg("shareLevel") ?? "label+status",
    lumaHandle: arg("lumaHandle"),
    lumaProfileUrl: arg("lumaProfileUrl"),
    githubHandle: arg("githubHandle"),
  });
  const userId = typeof json.userId === "string" ? json.userId : undefined;
  const eventId = typeof json.eventId === "string" ? json.eventId : undefined;
  const task = arg("task");
  if (userId && eventId && task) {
    await post(
      "/api/lobby/sync",
      { eventId, botId: userId, taskLabel: task, status: arg("status") ?? "working" },
      botHeaders(userId),
    );
  }
  console.log(JSON.stringify({ ok: true, command: "join", userId, eventId, eventCode: code.toUpperCase() }, null, 2));
}

async function invite(): Promise<void> {
  const eventId = arg("eventId");
  const botId = arg("botId");
  const attendeeId = arg("attendeeId");
  if (!eventId || !botId || !attendeeId) {
    fail("invite needs --eventId --botId --attendeeId.");
  }
  const { json } = await post(
    "/api/squads/invite",
    { eventId, attendeeId, squadId: arg("squadId") },
    botHeaders(botId),
  );
  console.log(JSON.stringify({ ok: true, command: "invite", snapshot: json }, null, 2));
}

async function requestJoin(): Promise<void> {
  const eventId = arg("eventId");
  const botId = arg("botId");
  const squadId = arg("squadId");
  if (!eventId || !botId || !squadId) {
    fail("request needs --eventId --botId --squadId.");
  }
  const { json } = await post("/api/squads/request", { eventId, squadId }, botHeaders(botId));
  console.log(JSON.stringify({ ok: true, command: "request", snapshot: json }, null, 2));
}

async function respond(): Promise<void> {
  const eventId = arg("eventId");
  const botId = arg("botId");
  const inviteId = arg("inviteId");
  const status = arg("status");
  if (!eventId || !botId || !inviteId || (status !== "accepted" && status !== "rejected")) {
    fail("respond needs --eventId --botId --inviteId --status accepted|rejected.");
  }
  const { json } = await post("/api/squads/respond", { eventId, inviteId, status }, botHeaders(botId));
  console.log(JSON.stringify({ ok: true, command: "respond", snapshot: json }, null, 2));
}

async function leave(): Promise<void> {
  const eventId = arg("eventId");
  const botId = arg("botId");
  if (!eventId || !botId) {
    fail("leave needs --eventId --botId.");
  }
  const { json } = await post("/api/squads/leave", { eventId, squadId: arg("squadId") }, botHeaders(botId));
  console.log(JSON.stringify({ ok: true, command: "leave", snapshot: json }, null, 2));
}

async function propose(): Promise<void> {
  const eventId = arg("eventId");
  const fromBotId = arg("fromBotId");
  const toBotId = arg("toBotId");
  const toSquadId = arg("toSquadId");
  if (!eventId || !fromBotId || (!toBotId && !toSquadId)) {
    fail("propose needs --eventId --fromBotId and --toBotId or --toSquadId.");
  }
  const { json } = await post(
    "/api/token-exchange/propose",
    {
      eventId,
      fromBotId,
      toBotId,
      toSquadId,
      taskLabel: arg("task"),
      status: arg("status") ?? "working",
    },
    botHeaders(fromBotId),
  );
  console.log(JSON.stringify({ ok: true, command: "propose", snapshot: json }, null, 2));
}

async function prompt(): Promise<void> {
  const eventId = arg("eventId");
  const botId = arg("botId");
  const text = arg("prompt");
  if (!eventId || !botId || !text) {
    fail("prompt needs --eventId --botId --prompt.");
  }
  const { json } = await post("/api/lobby/prompt", { eventId, botId, prompt: text }, botHeaders(botId));
  console.log(JSON.stringify({ ok: true, command: "prompt", intent: json.intent, snapshot: json.snapshot }, null, 2));
}

async function kick(): Promise<void> {
  const eventId = arg("eventId");
  const attendeeId = arg("attendeeId");
  if (!eventId || !attendeeId) {
    fail("kick needs --eventId --attendeeId --hostSecret.");
  }
  const { json } = await post("/api/bots/kick", { eventId, attendeeId }, botHeaders());
  console.log(JSON.stringify({ ok: true, command: "kick", snapshot: json }, null, 2));
}

async function enrich(): Promise<void> {
  const lumaHandle = arg("lumaHandle");
  const lumaProfileUrl = arg("lumaProfileUrl");
  if (!lumaHandle && !lumaProfileUrl) {
    fail("enrich needs --lumaHandle or --lumaProfileUrl.");
  }
  const { json } = await post(
    "/api/profile/enrich",
    {
      lumaHandle,
      lumaProfileUrl,
      githubHandle: arg("githubHandle"),
      botId: arg("botId"),
      eventId: arg("eventId"),
    },
    botHeaders(arg("botId")),
  );
  console.log(JSON.stringify({ ok: true, command: "enrich", profile: json.profile }, null, 2));
}

async function listLobby(): Promise<void> {
  const eventId = arg("eventId");
  const params = new URLSearchParams();
  if (eventId) {
    params.set("eventId", eventId);
  }
  const response = await fetch(`${baseUrl()}/api/lobby/snapshot?${params.toString()}`, {
    headers: { "x-lobby-as": "attendee", ...botHeaders(arg("botId")) },
  });
  const json = (await response.json()) as Json;
  if (!response.ok) {
    fail(typeof json.error === "string" ? json.error : "list failed");
  }
  console.log(JSON.stringify({ ok: true, command: "list", snapshot: json }, null, 2));
}

async function main(): Promise<void> {
  const cmd = command();
  switch (cmd) {
    case "help":
    case "-h":
    case "--help":
      help();
      return;
    case "join":
      await join();
      return;
    case "invite":
      await invite();
      return;
    case "request":
      await requestJoin();
      return;
    case "respond":
      await respond();
      return;
    case "leave":
      await leave();
      return;
    case "propose":
      await propose();
      return;
    case "prompt":
      await prompt();
      return;
    case "kick":
      await kick();
      return;
    case "enrich":
      await enrich();
      return;
    case "list":
      await listLobby();
      return;
    default:
      fail(`Unknown command: ${cmd}. Try help.`);
  }
}

void main();
