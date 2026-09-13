export const REPO_CLONE_URL = "https://github.com/frankterpo/grok-bot-lobby.git";
export const HEARTBEAT_SECONDS = 60;
export const GROK_BOT_SKILL_INSTALL = "npx skills add adamanz/grok-bot-skill -g -a cursor";

export type NoCloneJoinBlockArgs = {
  code: string;
  origin: string;
  name?: string;
  color?: string;
  task?: string;
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Copy-paste block: claim, optional task sync, 60s heartbeat loop — no repo clone. */
export function buildNoCloneCurlBlock(args: NoCloneJoinBlockArgs): string {
  const code = args.code.toUpperCase();
  const origin = args.origin.replace(/\/$/, "");
  const name = args.name ?? "Guest";
  const color = args.color ?? "cyan";
  const task = args.task ?? "Joining the lobby";

  return [
    `PUBLIC_URL=${origin}`,
    `CODE=${code}`,
    "",
    "# 1) Claim bot (hasGrokBot: true — run via Grok Bot Agent Computer)",
    `CLAIM=$(curl -sS -X POST "$PUBLIC_URL/api/bots/claim" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'x-lobby-as: attendee' \\`,
    `  -d '{"eventCode":"'"$CODE"'","name":${shellQuote(name)},"botColor":${shellQuote(color)},"hasGrokBot":true,"acceptPermissions":true,"shareLevel":"label+status"}')`,
    `BOT_ID=$(echo "$CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")`,
    `EVENT_ID=$(echo "$CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin)['eventId'])")`,
    `echo "$CLAIM" | python3 -m json.tool`,
    "",
    "# 2) Sync task token (optional)",
    `curl -sS -X POST "$PUBLIC_URL/api/lobby/sync" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'x-lobby-as: attendee' \\`,
    `  -H "x-lobby-bot-id: $BOT_ID" \\`,
    `  -d '{"eventId":"'"$EVENT_ID"'","botId":"'"$BOT_ID"'","taskLabel":${shellQuote(task)},"status":"working","shareLevel":"label+status"}'`,
    "",
    `# 3) Heartbeat every ${HEARTBEAT_SECONDS}s — keep terminal open`,
    `while true; do`,
    `  curl -sS -X POST "$PUBLIC_URL/api/presence/heartbeat" \\`,
    `    -H 'Content-Type: application/json' \\`,
    `    -H 'x-lobby-as: attendee' \\`,
    `    -H "x-lobby-bot-id: $BOT_ID" \\`,
    `    -d '{"eventId":"'"$EVENT_ID"'","botId":"'"$BOT_ID"'"}'`,
    `  sleep ${HEARTBEAT_SECONDS}`,
    `done`,
  ].join("\n");
}

/** Combined skill install + join curl — one paste in Grok Bot Agent Computer. */
export function buildZeroFrictionSetupBlock(args: NoCloneJoinBlockArgs): string {
  return [
    "# Step A — install grok-bot skill (skip if already installed)",
    GROK_BOT_SKILL_INSTALL,
    "",
    "# Step B — join lobby (claims slot, syncs task, heartbeats every 60s)",
    buildNoCloneCurlBlock(args),
  ].join("\n");
}

/** Self-contained block: clone lobby repo if needed, install deps, start loopback helper. */
export function buildSidecarStartBlock(): string {
  return [
    "# Paste once in Terminal on this Mac — clones repo if you don't have it yet",
    'HELPER_DIR="$HOME/.cache/grok-bot-lobby"',
    `if [ ! -d "$HELPER_DIR/.git" ]; then git clone ${REPO_CLONE_URL} "$HELPER_DIR"; fi`,
    'cd "$HELPER_DIR" && npm install && npm run local-join-bridge',
  ].join("\n");
}

export const SIDECAR_MAC_COMMAND_FILENAME = "start-grok-lobby-helper.command";

/** Mac double-clickable .command file — may hit Gatekeeper; prefer buildSidecarStartBlock paste. */
export function buildSidecarMacCommandFile(): string {
  return [
    "#!/bin/bash",
    "set -e",
    'HELPER_DIR="$HOME/.cache/grok-bot-lobby"',
    `if [ ! -d "$HELPER_DIR/.git" ]; then git clone ${REPO_CLONE_URL} "$HELPER_DIR"; fi`,
    'cd "$HELPER_DIR" && npm install && npm run local-join-bridge',
  ].join("\n");
}

/** One line — paste in Terminal.app (no Gatekeeper quarantine). */
export function buildSidecarOneLiner(): string {
  return [
    'HELPER_DIR="$HOME/.cache/grok-bot-lobby"',
    `if [ ! -d "$HELPER_DIR/.git" ]; then git clone ${REPO_CLONE_URL} "$HELPER_DIR"; fi`,
    'cd "$HELPER_DIR" && npm install && npm run local-join-bridge',
  ].join("; ");
}

/** After downloading .command from browser — clears macOS quarantine so Open works. */
export function buildSidecarGatekeeperUnblockCommand(
  filename: string = SIDECAR_MAC_COMMAND_FILENAME,
): string {
  return `xattr -d com.apple.quarantine ~/Downloads/${filename} 2>/dev/null; chmod +x ~/Downloads/${filename}; open ~/Downloads/${filename}`;
}

export function buildJoinLobbyNpmBlock(args: { code: string; origin: string; name?: string }): string {
  const code = args.code.toUpperCase();
  const origin = args.origin.replace(/\/$/, "");
  const name = args.name ?? "Guest";
  return [
    `git clone ${REPO_CLONE_URL}`,
    "cd grok-bot-lobby",
    "npm install",
    `npm run join-lobby -- --code ${code} --url ${origin} --name ${name} --color cyan --task "Joining the lobby"`,
  ].join("\n");
}

/** Clipboard text for the header join chip: URL plus a one-line guest-bot instruction. */
export function buildJoinLinkCopyText(args: { code: string; shareUrl: string }): string {
  const code = args.code.toUpperCase();
  let origin = args.shareUrl;
  try {
    origin = new URL(args.shareUrl).origin;
  } catch {
    // keep shareUrl as fallback origin
  }
  return `${args.shareUrl}\n\nJoin lobby ${code} at ${origin}`;
}

export function buildGuestJoinMessage(args: {
  code: string;
  shareUrl: string;
  publicOrigin: string;
  name?: string;
}): string {
  const code = args.code.toUpperCase();
  const curlBlock = buildNoCloneCurlBlock({
    code,
    origin: args.publicOrigin,
    name: args.name,
  });

  return [
    `Join lobby ${code} at ${args.shareUrl}`,
    "",
    "Tell your Grok Bot: paste this block into Agent Computer (no clone required):",
    "",
    curlBlock,
    "",
    "--- Full bridge (clone repo — context-from-bot, sync-token CLI) ---",
    buildJoinLobbyNpmBlock({ code, origin: args.publicOrigin, name: args.name }),
  ].join("\n");
}
