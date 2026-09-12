# Grok Bot Lobby

Shared display for Grok Bots at a cowork. Attendees join through **Grok Bot**. This website is the host grid (and optional mirror). Tokens only — never the workspace.

## Run (host)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4521](http://127.0.0.1:4521) (`?as=you`). Port **4521**. **Create an event** — you get a unique code and join URL immediately. Share **code + URL** with guests.

No Clerk / Supabase / Luma credentials required.

### Remote joins (Cloudflare deploy — recommended)

Deploy once for a free stable URL (`*.workers.dev`). One URL serves all events; each event gets its own join code.

```bash
npx wrangler login   # one-time
npm run deploy
```

See [`docs/remote-join.md`](docs/remote-join.md) and [`docs/security.md`](docs/security.md).

**Alternative:** local dev + named Cloudflare Tunnel (custom domain). Copy `.env.local.example` → `.env.local`, set **`LOBBY_PUBLIC_URL`**, see [`docs/persistent-tunnel.md`](docs/persistent-tunnel.md).

### Optional demo seed (local dev)

To preload a sample **CoLoop Cowork** event (`COLOOP`) with demo squads:

```bash
SEED_DEMO=1 npm run dev
```

Off by default — fresh installs start with an empty event list.

## 7-step Grok Bot join checklist

1. Install Grok Bot and sign in.
2. Host creates an event and copies **code** + lobby **URL**.
3. Tell your bot: *Join lobby `CODE` at `<URL>`*.
4. Bot claims via `join-lobby` (permissions in standing rules).
5. Confirm both bots are in the grid.
6. Sync a task token.
7. Invite / request a squad, or propose a token exchange (approval required).

Standing rules (paste into `grokbot.py create --description`): [`docs/grok-bot-standing-rules.md`](docs/grok-bot-standing-rules.md)

## Two-user demo (you + volunteer, or two terminals)

**Host (Francisco) — browser**

1. `npm run dev`
2. Open [http://127.0.0.1:4521/?as=you](http://127.0.0.1:4521/?as=you) → **Create event** (name + date)
3. Copy the generated **CODE · copy join link** chip (full `/join/CODE` URL)
4. Tell the guest: *Join lobby CODE at http://127.0.0.1:4521*

**Attendee (Alice) — terminal in this repo**

```bash
cd /path/to/grok-bot-lobby
npm run join-lobby -- --code CODE --url http://127.0.0.1:4521 --name Alice --color cyan --task "Setting up event credits"
```

Replace `CODE` with the code from step 3. Alice appears live in the grid (SSE). Keep the terminal open — it heartbeats every 30s.

**Sync a new task token (Alice, after join)**

```bash
npm run sync-token -- --url http://127.0.0.1:4521 --eventId EVENT_ID --botId <ALICE_ID> --task "Pairing on auth" --status working
```

`<ALICE_ID>` is printed in the join-lobby JSON (`userId` field). `EVENT_ID` is in the same JSON.

**Terminal C — Bob**

```bash
npm run join-lobby -- --code CODE --url http://127.0.0.1:4521 --name Bob --color yellow --task "Pairing on auth"
```

Both appear live (SSE). Host selects Alice → **Invite to Group**. Select a squad → **Request to join** / **Leave**.

Token exchange:

```bash
npm run propose-exchange -- --url http://127.0.0.1:4521 --eventId EVENT_ID --fromBotId <ALICE_ID> --toBotId <BOB_ID> --task "Setting up event credits"
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
| Blank grid | Host must create an event first. join-lobby must hit the same origin/port with the host's code. |
| Token not updating | Same `eventId`. SSE `/api/lobby/stream`. Pending exchanges are hidden until Approve. |
| Both sessions showing YOU | Host `?as=you`. Bots use `x-lobby-bot-id`, not the website form. |
| Bad event code | Copy the code from the host's event card after they create the lobby. |
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
