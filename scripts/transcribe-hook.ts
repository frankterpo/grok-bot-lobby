#!/usr/bin/env node
/**
 * Tier B transcribe hook: read grokbot.py transcript and map to lobby task label.
 * Does not post transcript to lobby — tokens only.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  join(homedir(), ".agents/skills/grok-bot/scripts/grokbot.py"),
  join(homedir(), ".cursor/skills/grok-bot/scripts/grokbot.py"),
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function resolveGrokbot(): string | null {
  for (const path of CANDIDATES) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

function main(): void {
  const name = arg("name");
  const limit = arg("limit") ?? "5";
  const script = resolveGrokbot();
  if (!script || !name) {
    console.error(JSON.stringify({ error: "Need --name and installed grokbot.py" }, null, 2));
    process.exit(1);
  }
  const result = spawnSync("python3", [script, "transcript", "--name", name, "--limit", limit], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  try {
    const payload = JSON.parse(result.stdout) as { entries?: Array<{ text?: string; role?: string }> };
    const last = [...(payload.entries ?? [])].reverse().find((entry) => entry.text?.trim());
    const label = last?.text?.trim().slice(0, 80) ?? "";
    console.log(
      JSON.stringify(
        {
          ok: true,
          name,
          suggestedTaskLabel: label || null,
          note: "Lobby shares task labels only — never full transcript.",
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(JSON.stringify({ error: "Could not parse grokbot transcript JSON" }, null, 2));
    process.exit(1);
  }
}

main();
