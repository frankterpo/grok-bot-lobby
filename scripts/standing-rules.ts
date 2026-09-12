#!/usr/bin/env node
/**
 * Bridge: print grok-bot-standing-rules.md for grokbot.py create --description.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "docs", "grok-bot-standing-rules.md");

try {
  process.stdout.write(readFileSync(path, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : "Could not read standing rules";
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}
