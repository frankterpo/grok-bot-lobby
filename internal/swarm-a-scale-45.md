# Swarm A — Scale (45 attendees)

## Delivered

- **Token dedup**: `sync` skips write/emit when taskLabel, status, focus, and shareLevel unchanged (`src/lib/token-utils.ts`).
- **Rate limits**: sync + heartbeat at 120/bot/min (DO + isolate); claim 20/IP/min; create-event 10/IP/min.
- **Heartbeat default**: 60s in `domain.ts`, `join-lobby.ts`, standing rules.
- **taskLabel cap**: 80 chars via `TASK_LABEL_MAX` / `truncateTaskLabel`.
- **Load test**: `scripts/load-test-45.ts` — batches of 5, default 45 bots.

## Verify

```bash
npm run load-test-45 -- --url https://grok-bot-lobby.teamdeel.workers.dev --code CODE
curl -s -o /dev/null -w "%{http_code}" -X POST https://grok-bot-lobby.teamdeel.workers.dev/api/events -H 'Content-Type: application/json' -d '{"name":"x","date":"y"}'
# expect 403 without host cookie
```
