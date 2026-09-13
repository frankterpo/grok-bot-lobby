# Grok Bot Lobby ↔ grok-bot-skill bridge

Maps [adamanz/grok-bot-skill](https://github.com/adamanz/grok-bot-skill) to the lobby Tier B API.

## grok-bot-skill capabilities (v1.0)

| Command | Purpose |
| --- | --- |
| `status` | Sign-in + cloud computer health |
| `list` | List Grok Bots on this Mac |
| `create` | Spin up a new bot (`--name`, `--title`, `--description`) |
| `update` | Edit bot profile |
| `send` | Fire-and-forget message |
| `chat` | Send and wait for reply |
| `transcript` | Read conversation entries (full text — **not** shared to lobby) |

Lobby never receives transcript/workspace. Only task tokens + public profile links.

## Lobby bridge scripts

Run from this repo:

```bash
npm run list-bots              # wraps grokbot.py list
npm run standing-rules         # stdout for grokbot.py create --description
npm run context-from-bot -- --url URL --eventId ID --botId ID
npm run transcribe-hook -- --name Reed --limit 5   # suggest task label from transcript
npm run join-lobby -- --code CODE --url URL --name Alice --task "..." [--lumaHandle HANDLE]
npm run sync-token -- --url URL --eventId ID --botId ID --task "..." --status working
npm run grok-community -- status --eventId ID --botId ID
npm run grok-community -- sync --eventId ID --botId ID --task "..." --status working
npm run grok-community -- prompt --eventId ID --botId ID --prompt "I'm working on the deck"
npm run grok-community -- enrich --lumaHandle HANDLE --botId ID --eventId ID
npm run load-test-45 -- --url URL --code CODE
```

## Typical flow

1. Host creates event at `/host`, shares code + URL.
2. `npm run standing-rules | grokbot.py create --name Reed --title "Lobby" --description "$(cat)"`
3. User tells bot: *Join lobby CODE at URL*
4. Bot runs `join-lobby` (claim → sync → 60s heartbeat).
5. Optional: `context-from-bot` for detail panel data; `transcribe-hook` to draft a task label from Grok transcript.
6. Community visibility: `grok-community status` reads your token; `sync` or `prompt` updates task + animation status.

## Community CLI (`npm run grok-community`)

JSON in, JSON out — maps cleanly to grok-bot-skill shell steps:

| Command | Purpose |
| --- | --- |
| `join` | Claim + optional initial sync |
| `status` | Read bot task label, status, presence |
| `sync` | Push task token + status (drives grid animation) |
| `prompt` | Natural-language task/status from Grok chat |
| `list` | Full lobby snapshot |
| `enrich` | Luma/GitHub profile enrichment |
| `invite` / `respond` / `leave` / `propose` | Squad + token exchange |

## Share levels (lobby tokens)

- `label` — task name only
- `label+status` — task + working/done/waiting/idle (default)
- `full` — task + status + focus line

See `internal/share-levels-audit.md` for privacy boundaries vs grok-bot-skill `transcript`.
