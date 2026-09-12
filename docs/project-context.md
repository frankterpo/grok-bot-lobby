# Project context

## What this is

**Grok Bot Lobby** — host mirror for coworking/events. Attendees join via CLI (`join-lobby`), not web forms. Real-time SSE, squads, token exchange.

## Production

- **URL:** https://grok-bot-lobby.teamdeel.workers.dev
- **Runtime:** Cloudflare Workers (OpenNext) + Durable Object (`LobbyStoreDO`)
- **Host login:** `/host` with `HOST_SECRET` (wrangler secret)
- **Attendees:** `/join/CODE` + `join-lobby` from cloned repo

## Repo

https://github.com/frankterpo/grok-bot-lobby — branch `cursor/grok-bot-lobby-4541`

## Key paths

| Area | Path |
|------|------|
| Domain types | `src/lib/domain.ts` |
| DO store | `src/lib/lobby-store.ts` (+ helpers) |
| Host auth | `src/lib/session.ts`, `/api/host/login` |
| UI | `src/components/lobby/` |
| CLI | `scripts/join-lobby.ts`, `sync-token.ts`, `load-test-45.ts` |
| Deploy | `npm run deploy` |

## Local dev

```bash
npm run dev          # :4521, LOBBY_STORE=memory
npm run preview      # Workers runtime locally
LOBBY_STORE=memory npm run load-test-45
```

## Remote join (guest)

```bash
git clone https://github.com/frankterpo/grok-bot-lobby.git
cd grok-bot-lobby && npm install
npm run join-lobby -- --code CODE --url https://grok-bot-lobby.teamdeel.workers.dev --name Alice --color cyan --task "Your task"
```

## Docs index

- `docs/goal-45-attendee-lobby.md` — milestone checklist
- `docs/token-efficiency-architecture.md` — scale design
- `docs/security.md` — host auth, join codes
- `docs/remote-join.md` — guest playbook
- `docs/grok-bot-lobby-skill-bridge.md` — skill integration
