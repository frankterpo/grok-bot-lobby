#!/usr/bin/env bash
# Harness: start sidecar, POST /join, verify bot stays active without manual curl refresh.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4521}"
SIDECAR="${SIDECAR:-http://127.0.0.1:9139}"
HOST_SECRET="${HOST_SECRET:-gbl-dev-host-secret-change-me}"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Local Join Bridge Harness @ $TS ==="
echo "BASE=$BASE SIDECAR=$SIDECAR"

cleanup() {
  if [[ -n "${SIDECAR_PID:-}" ]]; then
    kill "$SIDECAR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Wait for dev server
for i in $(seq 1 30); do
  if curl -sf "$BASE/" >/dev/null 2>&1; then
    echo "Dev server up"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "FAIL: dev server not reachable at $BASE"
    exit 1
  fi
  sleep 1
done

# Start sidecar
npm run local-join-bridge >/tmp/local-join-bridge.log 2>&1 &
SIDECAR_PID=$!
sleep 1

HEALTH=$(curl -sS "$SIDECAR/health")
echo "HEALTH=$HEALTH"
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('ok') and d.get('version'), d"

# CORS preflight from dev origin
echo "--- CORS preflight (dev origin) ---"
curl -sS -X OPTIONS "$SIDECAR/join" \
  -H "Origin: http://127.0.0.1:4521" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -D /tmp/sidecar-cors-dev.hdr -o /dev/null
grep -qi "access-control-allow-origin: http://127.0.0.1:4521" /tmp/sidecar-cors-dev.hdr

# CORS preflight from production origin
echo "--- CORS preflight (prod origin) ---"
curl -sS -X OPTIONS "$SIDECAR/join" \
  -H "Origin: https://grok-bot-lobby.teamdeel.workers.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -D /tmp/sidecar-cors-prod.hdr -o /dev/null
grep -qi "access-control-allow-origin: https://grok-bot-lobby.teamdeel.workers.dev" /tmp/sidecar-cors-prod.hdr

# Private Network Access preflight (HTTPS prod → localhost sidecar)
echo "--- PNA preflight (prod origin) ---"
curl -sS -X OPTIONS "$SIDECAR/join" \
  -H "Origin: https://grok-bot-lobby.teamdeel.workers.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -H "Access-Control-Request-Private-Network: true" \
  -D /tmp/sidecar-pna.hdr -o /dev/null
grep -qi "access-control-allow-private-network: true" /tmp/sidecar-pna.hdr
echo "PNA header OK"

# Host login + create event
curl -sS -c /tmp/bridge-host.txt -X POST "$BASE/api/host/login" \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"$HOST_SECRET\"}" >/dev/null

EVENT=$(curl -sS -b /tmp/bridge-host.txt -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" -H "x-lobby-as: you" \
  -d '{"name":"Sidecar harness","date":"2026-09-12"}')
CODE=$(echo "$EVENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eventCode') or d['event']['eventCode'])")
EVENT_ID=$(echo "$EVENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eventId') or d['event']['id'])")
echo "EVENT_CODE=$CODE EVENT_ID=$EVENT_ID"

# POST join via sidecar (persistent heartbeat loop)
JOIN1=$(curl -sS -X POST "$SIDECAR/join" \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:4521" \
  -d "{\"code\":\"$CODE\",\"url\":\"$BASE\",\"name\":\"SidecarBot\",\"task\":\"Sidecar task\",\"color\":\"cyan\"}")
echo "JOIN1=$JOIN1"
BOT=$(echo "$JOIN1" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok'], d; print(d['userId'])")
PID=$(echo "$JOIN1" | python3 -c "import sys,json; print(json.load(sys.stdin)['pid'])")
echo "SIDECAR_BOT=$BOT SIDECAR_PID_JOIN=$PID"

# Idempotent re-join returns same pid
JOIN2=$(curl -sS -X POST "$SIDECAR/join" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$CODE\",\"url\":\"$BASE\",\"name\":\"SidecarBot\",\"task\":\"Sidecar task\"}")
PID2=$(echo "$JOIN2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok'], d; print(d['pid'])")
if [[ "$PID" != "$PID2" ]]; then
  echo "FAIL: idempotent join returned different pid ($PID vs $PID2)"
  exit 1
fi
echo "Idempotent join OK (same pid=$PID)"

# Invalid event code returns actionable error (not a generic 502)
echo "--- Invalid code join ---"
INVALID=$(curl -sS -X POST "$SIDECAR/join" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"ZZZZZZZZ\",\"url\":\"$BASE\",\"name\":\"BadBot\"}")
echo "INVALID=$INVALID"
echo "$INVALID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert not d.get('ok'), d
err = d.get('error', '')
assert 'live lobby' in err.lower() or 'code' in err.lower(), err
print('Invalid code error OK:', err)
"

snap_state() {
  curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
    -H "x-lobby-as: host" -b /tmp/bridge-host.txt | python3 -c "
import sys,json
s=json.load(sys.stdin)
for p in s.get('presence',[]):
  if p['userId']=='$BOT':
    print('presence:', p.get('state'), 'lastHeartbeat=', p.get('lastHeartbeat'))
for a in s.get('attendees',[]):
  if a['id']=='$BOT':
    print('attendee:', a['name'], 'hasGrokBot=', a.get('hasGrokBot'))
"
}

echo "T+0s (sidecar join, no manual curl):"
snap_state

echo "Waiting 70s with NO manual heartbeat curl (sidecar should auto-heartbeat @ 60s)..."
sleep 70

echo "T+70s (no manual curl refresh):"
snap_state

STATE=$(curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
  -H "x-lobby-as: host" -b /tmp/bridge-host.txt | python3 -c "
import sys,json
s=json.load(sys.stdin)
for p in s.get('presence',[]):
  if p['userId']=='$BOT':
    print(p.get('state','missing'))
    break
else:
  print('missing')
")

if [[ "$STATE" != "active" ]]; then
  echo "FAIL: expected active presence after 70s without manual curl, got '$STATE'"
  exit 1
fi

echo "PASS: sidecar bot still active after 70s without manual curl refresh"
echo "=== DONE ==="
