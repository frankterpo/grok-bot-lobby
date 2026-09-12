# Remote join deployment assessment

## Options considered

| Option | Time | Verdict |
| --- | --- | --- |
| **A — Cloudflare quick tunnel** | Minutes | **Selected** — dev server + in-memory store unchanged |
| B — Cloudflare Pages | Hours+ | Blocked: no `wrangler.toml`, in-memory `lobby-store.ts` needs KV/D1 + `@cloudflare/next-on-pages` |
| C — Hybrid | — | Tunnel now; Pages scaffold deferred |

## Live tunnel (2026-09-12)

- Command: `npm run tunnel` → `cloudflared tunnel --url http://127.0.0.1:4521`
- Public URL: `https://pairs-forums-stronger-onto.trycloudflare.com`
- Join: `https://pairs-forums-stronger-onto.trycloudflare.com/join/COLOOP`
- Seed verified: code **COLOOP**, eventId **event_coloop**

## Code changes

- `src/lib/format.ts` — `originFromRequest` uses `LOBBY_PUBLIC_URL`, then `Host` / `X-Forwarded-Host` (fixes tunnel join URLs)
- `next.config.ts` — `allowedDevOrigins` includes `*.trycloudflare.com`
- `package.json` — `npm run tunnel`
- `.env.local.example`, `docs/remote-join.md`, README remote section

## Host must keep running

Quick tunnel + dev server. Tunnel URL changes each run unless a named tunnel + DNS is configured in Cloudflare Zero Trust.

## Verification

```bash
curl -sS 'https://pairs-forums-stronger-onto.trycloudflare.com/api/lobby/snapshot?code=COLOOP' -H 'x-lobby-as: you' | jq -r .joinUrl
# → https://pairs-forums-stronger-onto.trycloudflare.com/join/COLOOP

npm run join-lobby -- --code COLOOP --url https://pairs-forums-stronger-onto.trycloudflare.com --name RemoteTest --color cyan --once
```
