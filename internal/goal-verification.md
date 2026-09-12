# Goal verification — 45-attendee Grok Bot Lobby

**Branch:** `cursor/goal-45-attendee-ca84`  
**Deploy:** https://grok-bot-lobby.teamdeel.workers.dev  
**Version ID:** `4cf8be21-59f6-4787-9d28-e282b6702047`  
**Clone:** https://github.com/frankterpo/grok-bot-lobby.git

## Goal checklist (pass/fail)

| Goal area | Item | Status |
| --- | --- | --- |
| **A Scale** | Server token dedup | ✅ PASS |
| **A Scale** | Rate limits sync/heartbeat/claim | ✅ PASS |
| **A Scale** | 60s heartbeat in join-lobby | ✅ PASS |
| **A Scale** | taskLabel 80-char cap | ✅ PASS |
| **A Scale** | Load test 45 bots | ✅ PASS — 45/45 |
| **A Scale** | Deploy | ✅ PASS |
| **B Social** | Squad invites + token exchange + share levels + guest wizard | ✅ PASS |
| **C Profiles** | Luma/GitHub/Origin + enrich API | ✅ PASS |
| **D Bridge** | grok-bot-skill docs + CLI scripts | ✅ PASS |
| **Publish** | GitHub public repo | ⚠️ PARTIAL — `frankterpo/grok-bot-lobby` only |
| **Verify** | curl 403 no cookie | ✅ PASS |
| **Verify** | New API routes non-404 | ✅ PASS |
| **Verify** | `domain.ts` typed | ✅ PASS (375 lines) |
| **Verify** | All `src/lib/*.ts` ≤800 lines | ✅ PASS (max 623 `lobby-store.ts`) |
| **Verify** | 2-user join path | ✅ PASS (see below) |

## File line counts (`src/lib/*.ts`)

| File | Lines | ≤800 |
| --- | ---: | --- |
| `lobby-store.ts` | 623 | ✅ |
| `lobby-store-exchange.ts` | 239 | ✅ |
| `parsers.ts` | 338 | ✅ |
| `domain.ts` | 375 | ✅ |
| `lobby-store-present.ts` | 81 | ✅ |
| `lobby-store-helpers.ts` | 39 | ✅ |
| *(all others)* | &lt;280 | ✅ |

Split: `lobby-store-present.ts` (snapshot/present helpers) + `lobby-store-exchange.ts` (squad + token exchange ops) + `lobby-store-helpers.ts` (shared utils).

## 2-user join path (verified 2026-09-12)

### Steps

```bash
# 1. Start dev (memory store for local)
LOBBY_STORE=memory HOST_SECRET=gbl-dev-host-secret-change-me npm run dev

# 2. Host creates event
curl -s -X POST http://127.0.0.1:4521/api/events \
  -H 'Content-Type: application/json' \
  -H 'x-lobby-host-secret: gbl-dev-host-secret-change-me' \
  -H 'x-lobby-as: you' \
  -d '{"name":"Two-user demo","date":"2026-09-12"}'

# 3. Guest opens join page
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4521/join/MET6DHKF
# → 200

# 4. Guest claims via join-lobby bridge
npm run join-lobby -- --code MET6DHKF --url http://127.0.0.1:4521 \
  --name Alice --color cyan --task "Pairing on auth" --once

# 5. Host snapshot shows both bots
curl -s "http://127.0.0.1:4521/api/lobby/snapshot?eventId=event_ce574e6404" \
  -H 'x-lobby-host-secret: gbl-dev-host-secret-change-me' -H 'x-lobby-as: you'
```

### Evidence

| Step | Result |
| --- | --- |
| Host `POST /api/events` | 201 — code `MET6DHKF`, event `event_ce574e6404` |
| Guest `GET /join/MET6DHKF` | **200** |
| Guest `join-lobby --once` | **201** — `userId: user_ebb9708784`, task synced |
| Snapshot attendees | **2** — `Francisco`, `Alice` |
| **Overall** | **PASS** |

### join-lobby output (excerpt)

```json
{
  "ok": true,
  "name": "Alice",
  "userId": "user_ebb9708784",
  "eventId": "event_ce574e6404",
  "eventCode": "MET6DHKF",
  "taskLabel": "Pairing on auth",
  "status": "working",
  "heartbeatMs": 60000
}
```

## Production curl evidence

```
POST /api/profile/enrich  {"githubHandle":"octocat"}  → HTTP 200
GET  /api/bots/list                                 → HTTP 400
POST /api/events (no cookie)                        → HTTP 403
```

## Load test (45/45)

```json
{ "ok": true, "requested": 45, "joined": 45, "failed": 0, "elapsedMs": 717 }
```

## Swarm reports

- `internal/swarm-a-scale-45.md`
- `internal/swarm-b-social-onboarding.md`
- `internal/swarm-c-profiles.md`
- `internal/swarm-d-skill-bridge.md`
