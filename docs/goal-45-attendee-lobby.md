# Goal: 45-attendee Grok Bot Lobby

Event-ready lobby for Grok Bot users: host display, remote join, squads, token exchange, SSE presence.

## Checklist (completed)

### A — Scale
- [x] Server token dedup (`tokensEqual` in `src/lib/token-utils.ts`)
- [x] Rate limits: sync, heartbeat, claim, create-event
- [x] 60s heartbeat default (`HEARTBEAT_MS = 60_000`)
- [x] `taskLabel` 80-char cap
- [x] Load test: `npm run load-test-45`
- [x] Deploy: `npm run deploy` → https://grok-bot-lobby.teamdeel.workers.dev

### B — Social / onboarding
- [x] Squad invite (outbound + inbound request) + leave
- [x] Token exchange propose / approve / reject
- [x] Share levels: `label` / `label+status` / `full`
- [x] Guest wizard: clone → install → skill → join

### C — Profiles
- [x] Luma / GitHub / Origin inputs per bot
- [x] Fetch + cache public profile data
- [x] Detail panel display
- [x] Persist in Durable Object store

### D — grok-bot-skill bridge
- [x] Inspect `adamanz/grok-bot-skill`
- [x] CLI: `list-bots`, `context-from-bot`, `standing-rules`, `transcribe-hook`, `lobby-bridge`
- [x] Tier B transcribe hook (suggest label, never auto-post transcript)
- [x] `docs/grok-bot-lobby-skill-bridge.md`

### Security & publish
- [x] Host auth via `HOST_SECRET` + `/host` (not `?as=you`)
- [x] 8-char join codes, claim rate limits
- [x] Repo: https://github.com/frankterpo/grok-bot-lobby

## Verification

```bash
# Local 45-bot load test
npm run load-test-45

# Production (needs host-created event code)
npm run load-test-45 -- --url https://grok-bot-lobby.teamdeel.workers.dev --code YOUR_CODE

# Host auth blocked without cookie
curl -s -X POST https://grok-bot-lobby.teamdeel.workers.dev/api/events \
  -H 'Content-Type: application/json' -H 'x-lobby-as: you' \
  -d '{"name":"Test","date":"2026-09-12"}'
# → 403 Host authentication required.
```

## Swarm reports

See `internal/swarm-a-scale.md` through `internal/swarm-d-skill-bridge.md`.
