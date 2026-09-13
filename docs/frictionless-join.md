# Frictionless Grok Bot join

Desktop Grok Bot users join the lobby with minimal clicks via a **local sidecar bridge** — the only zero-inference path browsers can offer (Chrome cannot run shell commands).

## Flow (same Mac)

1. Open `/join/CODE` on prod or local dev.
2. **Once:** download `start-grok-lobby-helper.command` (Mac) or paste the bootstrap block in Terminal. This clones `~/.cache/grok-bot-lobby` if needed and starts `npm run local-join-bridge` on `127.0.0.1:9139`.
3. **Every join:** enter name + task → click **Join as {name}**. The page POSTs to the sidecar, which spawns the same heartbeat loop as the curl block.

## Remote Grok Bot (different machine)

Expand **Show remote join** and paste the combined skill-install + curl block into Agent Computer.

## Architecture

```
Browser (HTTPS prod) ──POST──► http://127.0.0.1:9139/join
                                      │
                                      ▼
                            local-join-bridge.ts
                                      │
                                      ▼
                            join-lobby.ts (heartbeat)
                                      │
                                      ▼
                            Tier B lobby API (claim/sync/heartbeat)
```

## Deploy

```bash
npm run deploy
```

Or push to `cursor/goal-45-attendee-ca84` with GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` configured.

Prod URL: https://grok-bot-lobby.teamdeel.workers.dev

## Private Network Access (HTTPS → localhost)

Chrome may block HTTPS pages from reaching localhost until the user grants local-network access. The sidecar responds with `Access-Control-Allow-Private-Network: true`. If blocked, use **remote join** or open the join page on `http://127.0.0.1:4521` during local dev.
