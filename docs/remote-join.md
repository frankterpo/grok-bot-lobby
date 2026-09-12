# Remote join

Guests need a **public lobby URL** plus an **event code** from the host. Localhost (`127.0.0.1:4521`) only works on the host machine.

## You must clone the repo first

`npm run join-lobby` is **not** a global CLI. It only works inside this project after dependencies are installed. Running it from `~` or any folder without `package.json` fails with **ENOENT**.

```bash
git clone https://github.com/franciscoterpolilli/grok-bot-lobby.git
cd grok-bot-lobby
npm install
```

Then run the join command below (or use the curl-only path if you refuse to clone).

## Recommended: Cloudflare deploy (Path B)

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

The share wizard auto-detects `*.workers.dev` and `*.pages.dev` hosts — env vars are optional when using the default deploy URL.

Stable join link (replace `CODE` with the host's event code):

```
https://grok-bot-lobby.<account>.workers.dev/join/CODE
```

### Local preview (Workers runtime)

```bash
npm run preview
```

Uses Miniflare with Durable Object bindings — same persistence model as production.

### Force in-memory store (local dev only)

```bash
LOBBY_STORE=memory npm run dev
```

## Alternative: local dev + Cloudflare Tunnel

For development on your Mac with a **custom domain** (requires DNS in Cloudflare):

**Full setup:** [`docs/persistent-tunnel.md`](./persistent-tunnel.md)

```bash
npm run tunnel:setup -- --hostname lobby.yourdomain.com --zone yourdomain.com
cp .env.local.example .env.local   # set LOBBY_PUBLIC_URL
npm run tunnel:install
npm run dev
```

## Remote attendee (Alice)

### A. Join link

```
https://YOUR_LOBBY_URL/join/CODE
```

Get **CODE** from the host after they create an event.

### B. Clone and install (required for `join-lobby`)

```bash
git clone https://github.com/franciscoterpolilli/grok-bot-lobby.git
cd grok-bot-lobby
npm install
```

### C. Join command

```bash
npm run join-lobby -- \
  --code CODE \
  --url https://YOUR_LOBBY_URL \
  --name Alice \
  --color cyan \
  --task "Setting up event credits"
```

Keep the terminal open — heartbeats every 30s. Use `--once` for a single claim+heartbeat.

**Sync task later:**

```bash
npm run sync-token -- \
  --url https://YOUR_LOBBY_URL \
  --eventId EVENT_ID \
  --botId <ALICE_ID> \
  --task "Pairing on auth" \
  --status working
```

### D. Curl-only join (no repo)

Claim once without cloning:

```bash
PUBLIC_URL=https://YOUR_LOBBY_URL
curl -sS -X POST "$PUBLIC_URL/api/bots/claim" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -d '{"eventCode":"CODE","name":"Alice","botColor":"cyan","hasGrokBot":true,"acceptPermissions":true}'
```

Save `userId` and `eventId` from the JSON response. To stay visible on the grid you must heartbeat every 30s — either keep a terminal open with a loop, or use `join-lobby` from the cloned repo:

```bash
# Manual heartbeat loop (replace EVENT_ID, BOT_ID from claim response)
while true; do
  curl -sS -X POST "$PUBLIC_URL/api/presence/heartbeat" \
    -H 'Content-Type: application/json' \
    -H 'x-lobby-as: attendee' \
    -H "x-lobby-bot-id: BOT_ID" \
    -d "{\"eventId\":\"EVENT_ID\",\"botId\":\"BOT_ID\"}"
  sleep 30
done
```

## Security

See [`docs/security.md`](./security.md) for join-code entropy, rate limits, and API scoping.

## Grok Bot credits (token burn)

**npm scripts do not consume Grok Bot chat credits.** They are plain HTTP calls.

Credits are spent when you **babysit the bot in Grok Bot chat**. Prefer the CLI bridge for lobby join/sync.
