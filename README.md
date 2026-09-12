# Grok Bot Lobby

Shared display for Grok Bots at a cowork. Attendees join through **Grok Bot**. This website is the host grid (and optional mirror). Tokens only — never the workspace.

## Run (host)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4521](http://127.0.0.1:4521) (`?as=you`). Port **4521**. Create an event (or Open host lobby for seeded **CoLoop Cowork** / `COLOOP`). Share **code + URL** immediately.

No Clerk / Supabase / Luma credentials required.

## 7-step Grok Bot join checklist

1. Install Grok Bot and sign in.
2. Host copies event **code** + lobby **URL**.
3. Tell your bot: *Join lobby `CODE` at `<URL>`*.
4. Bot claims via `join-lobby` (permissions in standing rules).
5. Confirm both bots are in the grid.
6. Sync a task token.
7. Invite / request a squad, or propose a token exchange (approval required).

Standing rules (paste into `grokbot.py create --description`): [`docs/grok-bot-standing-rules.md`](docs/grok-bot-standing-rules.md)

## Two-user demo (you + volunteer, or two terminals)

Seed: **CoLoop Cowork** · code **COLOOP** · URL `http://127.0.0.1:4521`

**Terminal A — host**

```bash
npm run dev
# browser: http://127.0.0.1:4521/?as=you
```

**Terminal B — Alice**

```bash
npm run join-lobby -- --code COLOOP --url http://127.0.0.1:4521 --name Alice --color cyan --task "Setting up event credits"
```

**Terminal C — Bob**

```bash
npm run join-lobby -- --code COLOOP --url http://127.0.0.1:4521 --name Bob --color yellow --task "Pairing on auth"
```

Both appear live (SSE). Host selects Alice → **Invite to Group**. Select a squad → **Request to join** / **Leave**.

Token exchange:

```bash
npm run propose-exchange -- --url http://127.0.0.1:4521 --eventId event_coloop --fromBotId <ALICE_ID> --toBotId <BOB_ID> --task "Setting up event credits"
```

Host (or Bob) **Approve** / **Reject** in the detail panel. Only then does the token show on the recipient card (`in: …`).

Use `--once` on join-lobby to claim+heartbeat once without the 30s loop.

## Host script

```bash
npm run dev
# then in UI: + → name/date → Create event → copy CODE + join URL
```

Create bots with standing rules:

```bash
python3 ~/.agents/skills/grok-bot/scripts/grokbot.py create \
  --name Reed \
  --title "Lobby teammate" \
  --description "$(sed -n '/^You are a Grok Bot/,\$p' docs/grok-bot-standing-rules.md)"
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank grid | Host must Open lobby. join-lobby must hit the same origin/port. |
| Token not updating | Same `eventId`. SSE `/api/lobby/stream`. Pending exchanges are hidden until Approve. |
| Both sessions showing YOU | Host `?as=you`. Bots use `x-lobby-bot-id`, not the website form. |
| Bad event code | Seed is `COLOOP`. Copy the host card. |
| Claim becomes Francisco | Bridge uses attendee slot + `x-lobby-bot-id`. Don't omit `--name`. |

Heartbeat 30s. Quiet → **no activity**. Never claimed → **bot not active**. Offline cards stay.

## API (Tier B)

- `POST /api/bots/claim`
- `POST /api/lobby/sync`
- `POST /api/presence/heartbeat`
- `GET /api/bots/context?botId=&eventId=`
- `POST /api/token-exchange/propose|approve|reject`
- `POST /api/squads/invite|request|leave`
- `GET /api/lobby/stream?eventId=&as=` — SSE, no polling

Bot requests: headers `x-lobby-as: attendee` and `x-lobby-bot-id: <id>` (plus eventCode on claim).
