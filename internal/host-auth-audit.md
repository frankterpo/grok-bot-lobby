# Host auth audit — 2026-09-12

## Vulnerability

`?as=you` / `x-lobby-as: you` granted host slot unconditionally. `parseSlot` defaulted to `"you"`. `canCreateEvent` checked `actor.slot === "you"`. `userIdForSlot("you")` returned `HOST_USER_ID` without verification.

## Fix

- `src/lib/host-auth.ts`: HMAC-SHA256 signed `gbl_host_session` cookie; validates `HOST_SECRET`.
- `session.ts`: slot `"you"` downgraded to `"attendee"` without valid host session; no default host userId.
- `policy.ts`: `canCreateEvent` / `canShareEvent` require `hostAuthenticated && role === host`.
- `lobby-store.ts`: host role on existing events gated by `hostAuthenticated`.
- `POST /api/events`: `requireHostActor` + 10/min IP rate limit.
- UI: `/host` login; removed public `?as=you` links.

## Production verification (grok-bot-lobby.teamdeel.workers.dev)

| Test | Result |
| --- | --- |
| `POST /api/events` + `x-lobby-as: you`, no cookie | 403 Host authentication required |
| `POST /api/events?as=you`, no cookie | 403 |
| `POST /api/host/login` + cookie + create event | 201 |

`HOST_SECRET` set via `wrangler secret put HOST_SECRET` during this deploy.
