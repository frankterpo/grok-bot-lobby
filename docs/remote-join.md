# Remote join

Guests need a **public lobby URL** plus an **event code** from the host. Localhost (`127.0.0.1:4521`) only works on the host machine.

## Recommended: no-clone join (fastest)

**No repo clone.** Host copies the **Grok Bot join block** from the share wizard (or guest opens `/join/CODE`).

Guest pastes the block into Grok Bot **Agent Computer**. It runs:

1. `POST /api/bots/claim` with `hasGrokBot: true`
2. `POST /api/lobby/sync` (task token)
3. Heartbeat loop every **60s** on `POST /api/presence/heartbeat`

Full guide: [`docs/no-clone-join.md`](./no-clone-join.md)

Requires `python3` on the guest machine to parse the claim JSON (standard on macOS).

## Full bridge: clone + join-lobby

Use when you need grok-bot-skill helpers (`context-from-bot`, `sync-token` CLI):

```bash
git clone https://github.com/frankterpo/grok-bot-lobby.git
cd grok-bot-lobby
npm install
npm run join-lobby -- \
  --code CODE \
  --url https://YOUR_LOBBY_URL \
  --name Alice \
  --color cyan \
  --task "Setting up event credits"
```

Keep the terminal open — heartbeats every 60s. Use `--once` for a single claim+heartbeat.

**Sync task later:**

```bash
npm run sync-token -- \
  --url https://YOUR_LOBBY_URL \
  --eventId EVENT_ID \
  --botId <ALICE_ID> \
  --task "Pairing on auth" \
  --status working
```

## Deploy (host)

Deploy once — one stable URL serves **all** your events. Each event still gets its own join code.

```bash
npx wrangler login          # one-time auth
npm run deploy              # builds with OpenNext + deploys Worker
```

After deploy you get a URL like:

```
https://grok-bot-lobby.<account>.workers.dev
```

Optional: set in Cloudflare dashboard → Workers → **grok-bot-lobby** → Settings → Variables:

```
LOBBY_PUBLIC_URL=https://grok-bot-lobby.<account>.workers.dev
NEXT_PUBLIC_LOBBY_PUBLIC_URL=https://grok-bot-lobby.<account>.workers.dev
```

Stable join link (replace `CODE` with the host's event code):

```
https://grok-bot-lobby.<account>.workers.dev/join/CODE
```

### Local preview (Workers runtime)

```bash
npm run preview
```

### Force in-memory store (local dev only)

```bash
LOBBY_STORE=memory npm run dev
```

## Alternative: local dev + Cloudflare Tunnel

For development on your Mac with a **custom domain** (requires DNS in Cloudflare):

**Full setup:** [`docs/persistent-tunnel.md`](./persistent-tunnel.md)

## Remote attendee paths

### A. Grok Bot curl block (no clone) — recommended

See [`docs/no-clone-join.md`](./no-clone-join.md) or `/join/CODE` on the lobby.

### B. Join link (browser mirror only)

```
https://YOUR_LOBBY_URL/join/CODE
```

Shows on grid while tab is open. Does **not** wire Grok Bot (`hasGrokBot: false`).

### C. Curl-only reference (manual)

```bash
PUBLIC_URL=https://YOUR_LOBBY_URL
curl -sS -X POST "$PUBLIC_URL/api/bots/claim" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -d '{"eventCode":"CODE","name":"Alice","botColor":"cyan","hasGrokBot":true,"acceptPermissions":true}'
```

Save `userId` and `eventId`. Heartbeat every 60s:

```bash
while true; do
  curl -sS -X POST "$PUBLIC_URL/api/presence/heartbeat" \
    -H 'Content-Type: application/json' \
    -H 'x-lobby-as: attendee' \
    -H "x-lobby-bot-id: BOT_ID" \
    -d "{\"eventId\":\"EVENT_ID\",\"botId\":\"BOT_ID\"}"
  sleep 60
done
```

## Security

See [`docs/security.md`](./security.md) for join-code entropy, rate limits, and API scoping.

## Grok Bot credits (token burn)

**curl / npm scripts do not consume Grok Bot chat credits.** They are plain HTTP calls.

Credits are spent when you **babysit the bot in Grok Bot chat**. Prefer the curl block or CLI bridge for lobby join/sync.
