# Token efficiency architecture

Design for keeping lobby SSE/API load bounded at 45+ attendees.

## Principles

1. **Tokens, not transcripts** — lobby sees `taskLabel`, `status`, optional `focus`; never full Grok Bot workspace text.
2. **Dedup writes** — `sync` skips DO write + SSE emit when label/status/focus/shareLevel unchanged (`tokensEqual`).
3. **Heartbeat cadence** — 60s default; stale after 180s without heartbeat.
4. **Label cap** — 80 chars max on server and parsers.
5. **Rate limits** — per-IP on claim, sync, heartbeat, create-event (edge + DO).

## Share levels

| Level | Others see |
|-------|------------|
| `label` | Task name only |
| `label+status` | Name + working/done/waiting/idle |
| `full` | Name + status + focus line |

Owner always sees own token. `shareTokens: false` hides from others entirely.

## SSE fan-out

`LobbyStoreDO` holds state and broadcasts snapshot deltas to connected clients. One DO instance per deployment namespace — avoid N×45 redundant token writes.

## Client scripts

- `join-lobby` — claim + initial sync + heartbeat loop
- `sync-token` — push token updates
- `load-test-45` — batch join stress test (5 concurrent batches)

## grok-bot-skill bridge (Tier B)

`transcribe-hook` reads local transcript via skill CLI, returns **suggested** 80-char label; agent must call `sync-token` explicitly.
