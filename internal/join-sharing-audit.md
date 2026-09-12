# Join & sharing flow audit

## Host shares

1. Host opens `http://127.0.0.1:4521/?as=you` and selects **CoLoop Cowork** (seed).
2. **Event code chip** (`COLOOP · copy join link`) copies the full join URL: `{origin}/join/COLOOP`.
3. Host header shows the join URL and the phrase: *Join lobby COLOOP at {origin}*.
4. Sidebar shows the same chip on the active event row (host only).
5. Creating a new event opens a **ShareLink** panel with the same URL pattern.

## Attendee joins (Grok Bot CLI)

From the grok-bot-lobby repo:

```bash
npm run join-lobby -- --code COLOOP --url http://127.0.0.1:4521 --name Alice --color cyan --task "Setting up event credits"
```

Flow inside `scripts/join-lobby.ts`:

1. `POST /api/bots/claim` — body: `{ eventCode, name, botColor, hasGrokBot, acceptPermissions }`
2. If `--task` given: `POST /api/lobby/sync` — body: `{ eventId, botId, taskLabel, status, shareLevel }`
3. `POST /api/presence/heartbeat` — body: `{ eventId, botId }`
4. Repeats heartbeat every 30s until SIGINT

## Auth headers (bot bridge)

| Header | Value | When |
| --- | --- | --- |
| `x-lobby-as` | `attendee` | All bot bridge requests |
| `x-lobby-bot-id` | `<userId from claim>` | sync, heartbeat, propose-exchange |
| `Content-Type` | `application/json` | All POSTs |

Browser host uses cookie + `x-lobby-as: you` (via `lobbyFetch`). No Clerk/Supabase.

## Share level toggle

Set on sync (`--shareLevel`) or in UI (YOU panel → Share task token):

| Level | Others see |
| --- | --- |
| `label` | Task name only |
| `label+status` | Task + working/done/waiting/idle (default) |
| `full` | Task + status + focus line |

Toggle off (`shareTokens: false`) hides the token from cards entirely.

## Token sync

```bash
npm run sync-token -- --url URL --eventId event_coloop --botId BOT_ID --task "..." --status working
```

Same headers as sync step above. Updates card label and working animation when status is `working` + active heartbeat.

## Seed event

- Name: **CoLoop Cowork**
- Code: **COLOOP**
- Event ID: **event_coloop**
- Host: Francisco (`user_francisco`)

## Verification (2026-09-12)

- Alice (`user_7e58158251`) joined via join-lobby, appeared in snapshot with `state: active`.
- joinUrl from API: `http://localhost:4521/join/COLOOP`
- EventCodeChip copies full joinUrl, not code alone.
