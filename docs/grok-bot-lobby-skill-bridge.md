# Grok Bot Lobby ↔ grok-bot-skill bridge

Connects the [grok-bot-skill](https://github.com/adamanz/grok-bot-skill) CLI (local Grok Bot teammates) with the Grok Bot Lobby HTTP API.

## Install grok-bot-skill

```bash
npx skills add adamanz/grok-bot-skill -g -a cursor
```

Skill path (typical): `~/.cursor/skills/grok-bot/scripts/grokbot.py`

### grok-bot-skill capabilities

| Command | Purpose |
|---------|---------|
| `status` | Sign-in + cloud computer health |
| `list` | All Grok Bot teammates (id, name, title, running state) |
| `create` | New teammate with standing rules in `--description` |
| `chat` / `send` | Message a bot (wait vs fire-and-forget) |
| `transcript` | Full conversation entries (Tier B — no privacy tiers) |
| `update` | Edit bot profile |

The skill talks to the Grok Bot gateway locally. It does **not** join the lobby by itself.

## Lobby bridge CLI

From this repo:

```bash
npm run lobby-bridge -- list-bots --url URL --eventId EVENT_ID
npm run lobby-bridge -- context-from-bot --url URL --eventId EVENT_ID --botId BOT_ID
npm run lobby-bridge -- standing-rules
npm run lobby-bridge -- transcribe-hook --name Reed --limit 5
```

| Subcommand | Maps to |
|------------|---------|
| `list-bots` | `GET /api/lobby/snapshot` → attendee grid + tokens |
| `context-from-bot` | `GET /api/bots/context` → profile, token, presence, exchanges |
| `standing-rules` | `docs/grok-bot-standing-rules.md` (paste into `grokbot.py create --description`) |
| `transcribe-hook` | Tier B: `grokbot.py transcript` → suggested 80-char task label for `/api/lobby/sync` |

## Typical agent flow

1. `npm run lobby-bridge -- standing-rules` → create Grok Bot with lobby permissions.
2. Host creates event; guest runs `npm run join-lobby -- --code CODE --url URL --name … --task "…"`.
3. `list-bots` / `context-from-bot` for situational awareness without scraping the UI.
4. Optional: `transcribe-hook` to derive a task label from Grok Bot conversation (agent summarizes; never paste full transcript to the lobby).

## Share levels (lobby only)

Lobby tokens respect `label` / `label+status` / `full`. grok-bot-skill `transcript` always returns full text — enforce privacy in the agent, not the skill CLI. See `internal/share-levels-audit.md`.

## Heartbeat

Default **60s** (`HEARTBEAT_MS` in `src/lib/domain.ts`). join-lobby and standing rules match.
