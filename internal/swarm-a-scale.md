---
subagentId: bc-8a1ec800-756f-5579-aa29-94d020cc3319
swarm: A
topic: scale
deploy: https://grok-bot-lobby.teamdeel.workers.dev
---

# Swarm A — Scale (45 attendees)

## Delivered

| Item | Implementation |
|------|----------------|
| Server token dedup | `tokensEqual` in `src/lib/token-utils.ts`; `sync` skips write/emit when label/status/focus/shareLevel unchanged |
| Rate limits | DO: `checkSyncRateLimit`, `checkHeartbeatRateLimit`, `checkClaimRateLimit`; edge `rate-limit.ts` on routes |
| 60s heartbeat | `HEARTBEAT_MS = 60_000`, `STALE_AFTER_MS = 180_000` in `src/lib/domain.ts`; `join-lobby.ts`, standing rules |
| taskLabel 80 cap | `TASK_LABEL_MAX` + `truncateTaskLabel` in `token-utils.ts`; parser rejects >80 |
| Load test | `scripts/load-test-45.ts` — 45 bots in batches of 5 |
| Deploy | `npm run deploy` → grok-bot-lobby.teamdeel.workers.dev |

## Verification evidence

**Local 45-bot load test (2026-09-12):**

```json
{
  "ok": true,
  "requested": 45,
  "joined": 45,
  "failed": 0,
  "elapsedMs": 643
}
```

**Production host auth (unauthenticated create event):**

```
curl -s -o /dev/null -w "%{http_code}" -X POST https://grok-bot-lobby.teamdeel.workers.dev/api/events \
  -H 'Content-Type: application/json' -H 'x-lobby-as: you' -d '{"name":"x","date":"y"}'
→ 403
```

**File size:** `lobby-store.ts` 794 lines (split helpers into `lobby-store-helpers.ts`, `lobby-store-present.ts`).
