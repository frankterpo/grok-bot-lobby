# Remote join (Cloudflare Tunnel)

Use this when a Grok Bot user is **not on the host machine**. Localhost (`127.0.0.1:4521`) only works on Francisco's laptop.

## Host setup (Francisco)

1. Start the lobby:

   ```bash
   npm install
   npm run dev
   ```

2. In a second terminal, start a **quick tunnel**:

   ```bash
   npm run tunnel
   ```

   Copy the `https://….trycloudflare.com` URL from the output.

3. Optional but recommended — pin join links to the public URL even while browsing localhost:

   ```bash
   cp .env.local.example .env.local
   # edit both vars to the tunnel URL, then restart npm run dev
   ```

4. Open the lobby at the **public URL** (or localhost with `.env.local` set) → **Open host lobby** → copy the **COLOOP · copy join link** chip.

**Caveats:** Quick tunnels are ephemeral (new URL each run), have no uptime SLA, and the host must keep `npm run dev` + `npm run tunnel` running. In-memory lobby state lives on the host process.

## Remote attendee (Alice)

### A. Join link

```
https://<tunnel-host>.trycloudflare.com/join/COLOOP
```

Seed event: **CoLoop Cowork** · code **COLOOP** · event id **event_coloop**

### B. Get `join-lobby` (needs this repo)

Minimal clone — only scripts + deps, no Grok Bot skill required for the bridge:

```bash
git clone <grok-bot-lobby-repo-url> grok-bot-lobby
cd grok-bot-lobby
npm install
```

If you cannot clone, use the **curl claim** one-liner below (claim + one heartbeat only; no 30s loop).

### C. Join command (replace PUBLIC_URL)

```bash
npm run join-lobby -- \
  --code COLOOP \
  --url https://PUBLIC_URL \
  --name Alice \
  --color cyan \
  --task "Setting up event credits"
```

Keep the terminal open — heartbeats every 30s. Use `--once` for a single claim+heartbeat.

**Sync task later:**

```bash
npm run sync-token -- \
  --url https://PUBLIC_URL \
  --eventId event_coloop \
  --botId <ALICE_ID> \
  --task "Pairing on auth" \
  --status working
```

`<ALICE_ID>` is the `userId` field in the join-lobby JSON output.

### D. Curl-only join (no repo)

```bash
PUBLIC_URL=https://YOUR_TUNNEL.trycloudflare.com
curl -sS -X POST "$PUBLIC_URL/api/bots/claim" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -d '{"eventCode":"COLOOP","name":"Alice","botColor":"cyan","hasGrokBot":true,"acceptPermissions":true}'
```

Then heartbeat with the returned `userId` / `eventId`:

```bash
curl -sS -X POST "$PUBLIC_URL/api/presence/heartbeat" \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-as: attendee' \
  -H "x-lobby-bot-id: USER_ID" \
  -d '{"eventId":"event_coloop","botId":"USER_ID"}'
```

For ongoing presence, repeat heartbeat every 30s or use `join-lobby` from the repo.

## Grok Bot credits (token burn)

**npm scripts (`join-lobby`, `sync-token`, `propose-exchange`) do not consume Grok Bot chat credits.** They are plain HTTP calls to the lobby API.

Credits are spent when you **babysit the bot in Grok Bot chat** (standing rules, back-and-forth). Prefer the CLI bridge for lobby join/sync; use chat only when you need the bot to reason or act outside the lobby API.

## Persistent deploy (future)

Cloudflare **Pages** would need `@cloudflare/next-on-pages` and moving `lobby-store.ts` off in-memory storage (KV or D1). No `wrangler.toml` in this repo yet — tunnel is the fastest path for demos.
