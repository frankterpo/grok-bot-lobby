# Swarm D — grok-bot-skill bridge

## grok-bot-skill (adamanz) capabilities

`status`, `list`, `create`, `update`, `send`, `chat`, `transcript` — see installed `SKILL.md`.

## Lobby bridge scripts

| npm script | Maps to |
| --- | --- |
| `list-bots` | `grokbot.py list` |
| `standing-rules` | stdout `docs/grok-bot-standing-rules.md` |
| `context-from-bot` | `GET /api/bots/context` |
| `transcribe-hook` | `grokbot.py transcript` → suggested 80-char task label (Tier B, no transcript to lobby) |
| `join-lobby` / `sync-token` | Tier B claim/sync/heartbeat |

Full doc: `docs/grok-bot-lobby-skill-bridge.md`.
