# No-clone join (recommended for guests)

Guests can join **without cloning this repo** by pasting a curl block into Grok Bot **Agent Computer**.

Production lobby: **https://grok-bot-lobby.teamdeel.workers.dev**

## What the host sends

After creating an event at `/host`, copy **Copy Grok Bot join block for guest** from the share wizard. It includes:

1. Join link (`/join/CODE`)
2. **No-clone curl block** (claim → sync task → 60s heartbeat loop, `hasGrokBot: true`)
3. Optional full bridge (clone + `join-lobby`) for skill helpers

## What the guest does

1. Open Grok Bot → Agent Computer (or terminal Grok Bot controls).
2. Paste the curl block from the host.
3. Replace `YOUR_NAME` and the task label if needed.
4. **Keep the terminal open** — heartbeats every 60s.

No `git clone`, no `npm install`, no Grok Bot chat credits burned on join.

## What you get vs full clone

| | No-clone curl | Clone + join-lobby |
|---|---|---|
| Grid presence | Yes (heartbeat loop) | Yes |
| `hasGrokBot: true` | Yes | Yes |
| Task sync | Yes (curl POST) | Yes |
| `context-from-bot` / skill bridge | No | Yes |
| Reads sand-data | No | Yes |

## Browser `/join/CODE`

Still available as **mirror only** (`hasGrokBot: false`). Tab must stay open. Not a Grok Bot integration.

## Local sidecar bridge (no paste)

Run the loopback helper on the same machine as Grok Bot so the lobby page can join without pasting curl:

```bash
npm run local-join-bridge
```

Listens on **http://127.0.0.1:9139** only. From `/join/CODE` (or any allowed origin), POST:

```bash
curl -sS -X POST http://127.0.0.1:9139/join \
  -H "Content-Type: application/json" \
  -d '{"code":"YOUR_CODE","url":"https://grok-bot-lobby.teamdeel.workers.dev","name":"YOUR_NAME","task":"Optional task"}'
```

The sidecar spawns `join-lobby.ts` with a persistent 60s heartbeat loop — same as the no-clone curl block, but triggered from the browser. Health check: `GET http://127.0.0.1:9139/health`.

Verify locally (dev server must use in-memory store):

```bash
LOBBY_STORE=memory npm run dev
bash scripts/local-join-bridge-test.sh
```

## When the host should test

**After deploy** (confirm new copy on `/join/CODE` and share wizard):

1. Host: `/host` → create event → copy Grok Bot join block.
2. Guest: paste block in Agent Computer (no clone).
3. Verify: guest card on host grid; survives after closing browser.
4. Optional: browser mirror guest shows without Grok Bot badge.

See also [`remote-join.md`](./remote-join.md) for deploy and curl reference.
