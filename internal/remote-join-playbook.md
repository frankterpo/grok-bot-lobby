# Remote join deployment assessment

## Options considered

| Option | Time | Verdict |
| --- | --- | --- |
| **A — Named Cloudflare tunnel** | One-time setup | **Selected** — stable hostname, launchd persistence |
| B — Cloudflare quick tunnel | Minutes | Ephemeral only — `npm run tunnel:quick` for demos |
| C — Cloudflare Pages | Hours+ | Future — needs KV/D1 + `@cloudflare/next-on-pages` |

## Implementation (2026-09-12)

### Named tunnel scaffold

- `cloudflared/config.yml.example` — template
- `scripts/setup-tunnel.sh` — `cloudflared tunnel login/create/route dns`, writes config
- `scripts/start-tunnel.sh` — `npm run tunnel` (named, not quick)
- `scripts/install-tunnel-service.sh` — macOS LaunchAgent
- `docs/persistent-tunnel.md` — full operator guide

### App config (from prior quick-tunnel work)

- `src/lib/format.ts` — `LOBBY_PUBLIC_URL` / forwarded host for join URLs
- `next.config.ts` — `allowedDevOrigins` includes tunnel hostname from env
- `.env.local.example` — stable URL vars

### Activation blocked on this machine

`~/.cloudflared/` is empty — `cloudflared tunnel login` required on host. User runs:

```bash
npm run tunnel:setup -- --hostname lobby.<zone> --zone <zone>
```

### Host must keep running

Named tunnel + dev server. Launchd keeps tunnel alive; `npm run dev` required for in-memory lobby. Pages deploy = future true serverless path.

## Copy-paste for remote joiner (after setup)

```
Join lobby COLOOP at https://lobby.yourdomain.com/join/COLOOP
```

```bash
npm run join-lobby -- --code COLOOP --url https://lobby.yourdomain.com --name RemoteTest --color cyan --once
```
