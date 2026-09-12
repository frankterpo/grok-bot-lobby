# Remote join (Cloudflare Tunnel)

Use this when a Grok Bot user is **not on the host machine**. Localhost (`127.0.0.1:4521`) only works on the host.

## Recommended: persistent named tunnel

For long-term remote access, use a **named tunnel** with a stable hostname — not ephemeral `trycloudflare.com` URLs.

**Full setup:** [`docs/persistent-tunnel.md`](./persistent-tunnel.md)

Quick summary:

```bash
npm run tunnel:setup -- --hostname lobby.yourdomain.com --zone yourdomain.com
cp .env.local.example .env.local   # set LOBBY_PUBLIC_URL
npm run tunnel:install             # macOS launchd — survives reboot
npm run dev                        # terminal 1
# tunnel runs via launchd, or: npm run tunnel
```

Stable join link (replace `CODE` with the code the host copies after creating an event):

```
https://lobby.yourdomain.com/join/CODE
```

## Ephemeral quick tunnel (demos only)

`npm run tunnel:quick` prints a new `https://….trycloudflare.com` URL each run. **Do not use for production** — URL dies when the process stops.

```bash
npm run dev          # terminal 1
npm run tunnel:quick # terminal 2 — copy URL, set .env.local, restart dev
```

## Remote attendee (Alice)

### A. Join link

```
https://lobby.yourdomain.com/join/CODE
```

Get **CODE** from the host after they create an event in the lobby UI.

### B. Get `join-lobby` (needs this repo)

```bash
git clone <grok-bot-lobby-repo-url> grok-bot-lobby
cd grok-bot-lobby
npm install
```

If you cannot clone, use the **curl claim** one-liner below.

### C. Join command

```bash
npm run join-lobby -- \
  --code CODE \
  --url https://lobby.yourdomain.com \
  --name Alice \
  --color cyan \
  --task "Setting up event credits"
```

Keep the terminal open — heartbeats every 30s. Use `--once` for a single claim+heartbeat.

**Sync task later:**

```bash
npm run sync-token -- \
  --url https://lobby.yourdomain.com \
  --eventId EVENT_ID \
  --botId <ALICE_ID> \
  --task "Pairing on auth" \
  --status working
```

### D. Curl-only join (no repo)

```bash
PUBLIC_URL=https://lobby.yourdomain.com
curl -sS -X POST "$PUBLIC_URL/api/bots/claim" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -d '{"eventCode":"CODE","name":"Alice","botColor":"cyan","hasGrokBot":true,"acceptPermissions":true}'
```

Then heartbeat with the returned `userId` / `eventId`:

```bash
curl -sS -X POST "$PUBLIC_URL/api/presence/heartbeat" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -H "x-lobby-bot-id: USER_ID" \
  -d '{"eventId":"EVENT_ID","botId":"USER_ID"}'
```

## Grok Bot credits (token burn)

**npm scripts do not consume Grok Bot chat credits.** They are plain HTTP calls.

Credits are spent when you **babysit the bot in Grok Bot chat**. Prefer the CLI bridge for lobby join/sync.

## Persistent deploy (future)

Cloudflare **Pages** would need `@cloudflare/next-on-pages` and moving `lobby-store.ts` off in-memory storage (KV or D1). That gives true serverless persistence without keeping a laptop online.
