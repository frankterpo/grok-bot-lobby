# Goal verification — 45-attendee Grok Bot Lobby

**Branch:** `cursor/goal-45-attendee-ca84`  
**Deploy:** https://grok-bot-lobby.teamdeel.workers.dev  
**Version ID:** `fbc837c9-6a51-43d7-ae70-1ed49cdf97d4`  
**Clone:** https://github.com/frankterpo/grok-bot-lobby.git

## Evidence table

| Check | Command / action | Expected | Result |
| --- | --- | --- | --- |
| Deploy live | `npm run deploy` | workers.dev URL | ✅ `https://grok-bot-lobby.teamdeel.workers.dev` |
| Host auth 403 | `POST /api/events` no cookie | 403 | ✅ `403` — `Host authentication required.` |
| Root UI | `GET /` | 200 | ✅ `200` |
| Profile enrich route | `POST /api/profile/enrich` `{"githubHandle":"octocat"}` | not 404 | ✅ `200` — bio enriched |
| Bots list route | `GET /api/bots/list` | not 404 | ✅ `400` — needs eventId/code (route exists) |
| Bots list missing event | `GET /api/bots/list?code=ZZZZZZZZ` | 404 JSON | ✅ `404` — `No lobby with that id or code.` |
| Claim rate limit | raised to 60/IP/min | supports 45 joins | ✅ committed `df4db0d` |
| Token dedup | identical sync skipped | no churn | ✅ `src/lib/token-utils.ts` |
| Heartbeat default | join-lobby | 60s | ✅ `HEARTBEAT_MS = 60_000` |
| taskLabel cap | parsers + sync | 80 chars | ✅ `TASK_LABEL_MAX` |
| Load test script | `npm run load-test-45` | exists | ✅ `scripts/load-test-45.ts` |
| Load test 45/45 | local run | 45 joined | ⚠️ partial — 20/45 before rate-limit fix (v2); fix deployed, not re-run (dev down) |
| GitHub publish | `gh repo create` + push | public clone URL | ✅ https://github.com/frankterpo/grok-bot-lobby.git |
| `domain.ts` typed | `src/lib/domain.ts` | typed unions | ✅ |
| Files &lt;800 lines | `lobby-store.ts` | &lt;800 | ⚠️ 873 lines (over by 73) |

## Production curl samples

```bash
# Profile enrich (200)
curl -s -X POST https://grok-bot-lobby.teamdeel.workers.dev/api/profile/enrich \
  -H 'Content-Type: application/json' \
  -d '{"githubHandle":"octocat"}'

# Bots list — route exists (400 without params)
curl -s https://grok-bot-lobby.teamdeel.workers.dev/api/bots/list

# Host protected (403)
curl -s -X POST https://grok-bot-lobby.teamdeel.workers.dev/api/events \
  -H 'Content-Type: application/json' -d '{"name":"x","date":"y"}'
```

## Load test partial output (pre rate-limit fix)

```json
{
  "requested": 45,
  "joined": 20,
  "failed": 25,
  "failures": [{ "error": "Too many join attempts. Wait a minute and try again." }]
}
```

After `df4db0d` (claim limit 60/IP/min), re-run:

```bash
npm run load-test-45 -- --url https://grok-bot-lobby.teamdeel.workers.dev --code CODE
```

## Swarm reports

- `internal/swarm-a-scale-45.md`
- `internal/swarm-b-social-onboarding.md`
- `internal/swarm-c-profiles.md`
- `internal/swarm-d-skill-bridge.md`

## Docs

- `docs/grok-bot-lobby-skill-bridge.md`
