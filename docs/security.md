# Lobby security model

## Join codes

- Event codes are **8-character** crypto-random strings from an unambiguous alphabet (`A–Z` minus `I`/`O`, digits `2–9`).
- Entropy: ~32⁸ ≈ **1.1 trillion** combinations — not sequential or guessable from timestamps.
- Codes are the **only** public identifier. Guests use `/join/[code]`; internal `eventId` values are never exposed in public URLs.

## API access

| Route | Public? | Notes |
| --- | --- | --- |
| `POST /api/bots/claim` | Yes (code required) | Rate-limited: 20 attempts / IP / minute |
| `GET /api/lobby/snapshot?code=` | Yes (code required) | Returns one event only |
| `GET /api/lobby/stream?eventId=` | Yes (with eventId) | SSE for a known event; eventId alone is insufficient without membership |
| `GET /api/events` | Host session only | Snapshot `events` list scoped to host/attendee membership — **no global event listing** |
| `POST /api/events` | Host slot only | Creates event; returns join code |

There is **no** unauthenticated API to list all events or enumerate codes.

## Rate limiting

- **Claim/join** (`POST /api/bots/claim`): 20 requests per IP per minute (Durable Object + isolate fallback).
- Failed code lookups return generic 404 — no hint whether a code format is valid.

## Persistence (production)

- Lobby state lives in a **Durable Object** (`LobbyStoreDO`) — survives restarts and scales across Workers isolates.
- SSE fan-out is coordinated inside the DO so all connected clients receive consistent snapshots.

## Host responsibilities

- Treat join codes like room passwords — share only with intended guests.
- Rotate by creating a new event if a code is leaked.
- For production, deploy to Cloudflare and use the stable `*.workers.dev` / `*.pages.dev` URL (see [`remote-join.md`](./remote-join.md)).
