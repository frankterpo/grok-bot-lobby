#!/usr/bin/env bash
# Measure presence decay when heartbeats stop (STALE_AFTER_MS=180s)
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:4521}"
HOST_SECRET="${HOST_SECRET:-gbl-dev-host-secret-change-me}"

curl -sS -c /tmp/stale-host.txt -X POST "$BASE/api/host/login" \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"$HOST_SECRET\"}" >/dev/null

EVENT=$(curl -sS -b /tmp/stale-host.txt -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" -H "x-lobby-as: you" \
  -d '{"name":"Stale timing test","date":"2026-09-12"}')
CODE=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['event']['eventCode'])")
EVENT_ID=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['event']['id'])")

# Tab bot: one heartbeat then stop
CLAIM=$(curl -sS -c /tmp/stale-tab.txt -X POST "$BASE/api/bots/claim" \
  -H "Content-Type: application/json" -H "x-lobby-as: attendee" \
  -d "{\"eventCode\":\"$CODE\",\"name\":\"StaleTab\",\"botColor\":\"cyan\",\"hasGrokBot\":true,\"acceptPermissions\":true,\"shareLevel\":\"label+status\"}")
BOT=$(echo "$CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")
curl -sS -b /tmp/stale-tab.txt -X POST "$BASE/api/presence/heartbeat" \
  -H "Content-Type: application/json" -H "x-lobby-as: attendee" -H "x-lobby-bot-id: $BOT" \
  -d "{\"eventId\":\"$EVENT_ID\",\"botId\":\"$BOT\"}" >/dev/null

# Curl bot: continuous heartbeats every 30s
CURL_OUT=$(node --experimental-strip-types --no-warnings scripts/join-lobby.ts \
  --code "$CODE" --url "$BASE" --name "StaleCurl" --once 2>/dev/null)
CURL_BOT=$(echo "$CURL_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")

snap_state() {
  curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
    -H "x-lobby-as: host" -b /tmp/stale-host.txt | python3 -c "
import sys,json
s=json.load(sys.stdin)
for p in s.get('presence',[]):
  if p['userId'] in ('$BOT','$CURL_BOT'):
    print(p['userId'][:12], p.get('state'), p.get('lastHeartbeat'))
"
}

echo "EVENT=$CODE BOT=$BOT CURL=$CURL_BOT"
echo "T+0s (tab hb once, curl hb once):"
snap_state

for wait in 65 125 185; do
  echo "Waiting to T+${wait}s..."
  sleep $((wait - ${LAST:-0}))
  LAST=$wait
  # Refresh curl bot only
  curl -sS -X POST "$BASE/api/presence/heartbeat" \
    -H "Content-Type: application/json" -H "x-lobby-as: attendee" \
    -H "x-lobby-bot-id: $CURL_BOT" \
    -d "{\"eventId\":\"$EVENT_ID\",\"botId\":\"$CURL_BOT\"}" >/dev/null
  echo "T+${wait}s (curl refreshed, tab silent):"
  snap_state
done
