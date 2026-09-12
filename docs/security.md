# Lobby security model

## Threat model

### Query-param spoofing (fixed)

Previously, anyone could append `?as=you` or send `x-lobby-as: you` and receive host privileges — including unlimited event creation. **This is no longer possible.**

Host access now requires a **signed httpOnly session cookie** issued only after validating `HOST_SECRET`. The `?as=you` query param and `x-lobby-as: you` header are ignored for authorization; they may affect UI slot selection only after a valid host session exists.

### Host authentication

| Mechanism | Purpose |
| --- | --- |
| `HOST_SECRET` | Long random secret set via `wrangler secret put HOST_SECRET` (production) or `.env.local` (local dev) |
| `POST /api/host/login` | Body `{ "secret": "..." }` or header `x-lobby-host-secret` — sets signed `gbl_host_session` cookie |
| `GET /api/host/login?secret=...` | One-time setup link (use out-of-band only; never publish in docs or share URLs) |
| `gbl_host_session` cookie | HMAC-SHA256 signed token, 30-day expiry, httpOnly |

**Never** put `HOST_SECRET` in public URLs, README links, or guest-facing messages.

### Attendee authentication

Attendees join via **`/join/CODE`** and the bot claim flow:

- `POST /api/bots/claim` with event code + bot name
- Headers `x-lobby-as: attendee` and `x-lobby-bot-id` for bridge scripts
- Sets `gbl_attendee_id` cookie on successful claim

`?as=attendee` without a bot id or claim cookie is **read-only / join prompt** — not host.

### Host secret rotation

1. Generate a new long random secret.
2. `npx wrangler secret put HOST_SECRET` with the new value.
3. All existing host session cookies become invalid immediately (signature mismatch).
4. Host re-authenticates at `/host` with the new secret.

## Join codes

- Event codes are **8-character** crypto-random strings from an unambiguous alphabet (`A–Z` minus `I`/`O`, digits `2–9`).
- Entropy: ~32⁸ ≈ **1.1 trillion** combinations — not sequential or guessable from timestamps.
- Codes are the **only** public identifier. Guests use `/join/[code]`; internal `eventId` values are never exposed in public URLs.

## API access

| Route | Public? | Notes |
| --- | --- | --- |
| `POST /api/bots/claim` | Yes (code required) | Rate-limited: 20 attempts / IP / minute |
| `GET /api/lobby/snapshot?code=` | Yes (code required) | Returns one event only |
| `GET /api/lobby/stream?eventId=` | Yes (with eventId) | SSE for a known event |
| `GET /api/events` | Host session only | Scoped to authenticated host membership |
| `POST /api/events` | **Host session required** | Creates event; rate-limited 10 / IP / minute |
| `POST /api/host/login` | Secret required | Issues host session cookie |

There is **no** unauthenticated API to list all events or enumerate codes.

## Rate limiting

- **Claim/join** (`POST /api/bots/claim`): 20 requests per IP per minute.
- **Event creation** (`POST /api/events`): 10 requests per IP per minute.
- Failed code lookups return generic 404 — no hint whether a code format is valid.

## Persistence (production)

- Lobby state lives in a **Durable Object** (`LobbyStoreDO`) — survives restarts and scales across Workers isolates.
- SSE fan-out is coordinated inside the DO so all connected clients receive consistent snapshots.

## Host responsibilities

- Treat join codes like room passwords — share only with intended guests.
- Treat `HOST_SECRET` like a root password — share only with organizers, never in URLs.
- Rotate by creating a new event if a code is leaked; rotate `HOST_SECRET` if the secret is exposed.
- For production, deploy to Cloudflare and use the stable `*.workers.dev` URL (see [`remote-join.md`](./remote-join.md)).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `HOST_SECRET` | Production: **yes** | `wrangler secret put HOST_SECRET`. Local dev falls back to documented dev default if unset. |
| `LOBBY_PUBLIC_URL` | Recommended | Stable public URL for join links |
