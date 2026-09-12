#!/usr/bin/env node
/**
 * Bridge: list Grok Bots via grokbot.py (adamanz/grok-bot-skill).
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  join(homedir(), ".agents/skills/grok-bot/scripts/grokbot.py"),
  join(homedir(), ".cursor/skills/grok-bot/scripts/grokbot.py"),
];

function resolveGrokbot(): string | null {
  for (const path of CANDIDATES) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

function main(): void {
  const script = resolveGrokbot();
  if (!script) {
    console.error(
      JSON.stringify(
        {
          error: "grokbot.py not found. Install adamanz/grok-bot-skill.",
          candidates: CANDIDATES,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  const result = spawnSync("python3", [script, "list"], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout);
}

main();
