---
subagentId: bc-8a1ec800-756f-5579-aa29-94d020cc3319
swarm: D
topic: skill-bridge
---

# Swarm D — grok-bot-skill bridge

## Skill inspected

`npx skills add adamanz/grok-bot-skill -g -a cursor` installs CLI at `~/.cursor/skills/grok-bot/scripts/grokbot.py`.

Capabilities: `status`, `list`, `create`, `update`, `chat`, `send`, `transcript` (full text, no privacy tiers).

## Lobby bridge CLI

| npm script | Script | Purpose |
|------------|--------|---------|
| `lobby-bridge` | `scripts/lobby-bridge.ts` | Unified subcommands |
| `list-bots` | `scripts/list-bots.ts` | Snapshot attendee grid |
| `context-from-bot` | `scripts/context-from-bot.ts` | `GET /api/bots/context` |
| `standing-rules` | `scripts/standing-rules.ts` | Emit `docs/grok-bot-standing-rules.md` |
| `transcribe-hook` | `scripts/transcribe-hook.ts` | Tier B: transcript → 80-char task label suggestion |

User-facing doc: `docs/grok-bot-lobby-skill-bridge.md`.

## Tier B transcribe hook

`transcribe-hook` shells to `grokbot.py transcript`, returns `suggestedTaskLabel` for agent to push via `sync-token` — never auto-posts full transcript to lobby.
