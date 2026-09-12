#!/usr/bin/env bash
# Browser Grok thorough test harness — API-level tests (no browser UI)
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4521}"
HOST_SECRET="${HOST_SECRET:-gbl-dev-host-secret-change-me}"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Browser Grok Test Harness @ $TS ==="
echo "BASE=$BASE"

# Wait for dev server
for i in $(seq 1 30); do
  if curl -sf "$BASE/" >/dev/null 2>&1; then
    echo "Dev server up"
    break
  fi
  sleep 1
done

# Host login (cookie session required for createEvent)
curl -sS -c /tmp/host-cookies.txt -X POST "$BASE/api/host/login" \
  -H "Content-Type: application/json" \
  -H "x-lobby-host-secret: $HOST_SECRET" \
  -d "{\"secret\":\"$HOST_SECRET\"}" >/dev/null

# Create event
EVENT=$(curl -sS -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" \
  -H "x-lobby-as: you" \
  -H "x-lobby-host-secret: $HOST_SECRET" \
  -b /tmp/host-cookies.txt \
  -d '{"name":"Browser Grok Test","date":"2026-09-12"}')
CODE=$(echo "$EVENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eventCode') or d['event']['eventCode'])")
EVENT_ID=$(echo "$EVENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eventId') or d['event']['id'])")
echo "EVENT_CODE=$CODE EVENT_ID=$EVENT_ID"

# --- Test 1a: Browser tab join (hasGrokBot:true + sync, single heartbeat) ---
TAB_CLAIM=$(curl -sS -X POST "$BASE/api/bots/claim" \
  -H "Content-Type: application/json" \
  -H "x-lobby-as: attendee" \
  -c /tmp/tab-cookies.txt \
  -d "{\"eventCode\":\"$CODE\",\"name\":\"TabBot\",\"botColor\":\"cyan\",\"hasGrokBot\":true,\"acceptPermissions\":true,\"shareLevel\":\"label+status\"}")
TAB_BOT=$(echo "$TAB_CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")
echo "TAB_BOT=$TAB_BOT"

curl -sS -X POST "$BASE/api/lobby/sync" \
  -H "Content-Type: application/json" \
  -H "x-lobby-as: attendee" \
  -H "x-lobby-bot-id: $TAB_BOT" \
  -b /tmp/tab-cookies.txt \
  -d "{\"eventId\":\"$EVENT_ID\",\"botId\":\"$TAB_BOT\",\"taskLabel\":\"Browser tab task\",\"status\":\"working\",\"shareLevel\":\"label+status\"}" >/dev/null

TAB_HB=$(curl -sS -X POST "$BASE/api/presence/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-lobby-as: attendee" \
  -H "x-lobby-bot-id: $TAB_BOT" \
  -b /tmp/tab-cookies.txt \
  -d "{\"eventId\":\"$EVENT_ID\",\"botId\":\"$TAB_BOT\"}")

echo "--- Tab join snapshot excerpt ---"
echo "$TAB_HB" | python3 -c "
import sys,json
s=json.load(sys.stdin)
for a in s.get('attendees',[]):
  if a['id']=='$TAB_BOT':
    print('attendee:', a['name'], 'hasGrokBot:', a.get('hasGrokBot'))
for p in s.get('presence',[]):
  if p['userId']=='$TAB_BOT':
    print('presence:', p)
for t in s.get('tokens',[]):
  if t['botId']=='$TAB_BOT':
    print('token:', t)
"

# --- Test 1b: Curl block bot (join-lobby --once) ---
CURL_OUT=$(node --experimental-strip-types --no-warnings scripts/join-lobby.ts \
  --code "$CODE" --url "$BASE" --name "CurlBot" --color yellow \
  --task "Curl block task" --once 2>/dev/null)
CURL_BOT=$(echo "$CURL_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")
echo "CURL_BOT=$CURL_BOT"

CURL_SNAP=$(curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
  -H "x-lobby-as: host" \
  -H "x-lobby-host-secret: $HOST_SECRET")

echo "--- Both bots on grid ---"
echo "$CURL_SNAP" | python3 -c "
import sys,json
s=json.load(sys.stdin)
for a in s.get('attendees',[]):
  if a['id'] in ('$TAB_BOT','$CURL_BOT'):
    print('attendee:', a['id'][:12], a['name'], 'hasGrokBot:', a.get('hasGrokBot'))
for p in s.get('presence',[]):
  if p['userId'] in ('$TAB_BOT','$CURL_BOT'):
    print('presence:', p['userId'][:12], p.get('state'), p.get('lastHeartbeat'))
"

# --- Test 1c: Tab "close" — no heartbeat for 5s, compare states ---
echo "--- Waiting 5s without tab heartbeat (simulating tab close) ---"
sleep 5
NO_HB=$(curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
  -H "x-lobby-as: host" \
  -H "x-lobby-host-secret: $HOST_SECRET")
echo "$NO_HB" | python3 -c "
import sys,json
s=json.load(sys.stdin)
for p in s.get('presence',[]):
  if p['userId'] in ('$TAB_BOT','$CURL_BOT'):
    print('after 5s no tab hb:', p['userId'][:12], 'state=', p.get('state'))
"

# Curl bot gets another heartbeat
curl -sS -X POST "$BASE/api/presence/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-lobby-as: attendee" \
  -H "x-lobby-bot-id: $CURL_BOT" \
  -d "{\"eventId\":\"$EVENT_ID\",\"botId\":\"$CURL_BOT\"}" >/dev/null

echo "--- Curl bot heartbeat refreshed; tab bot still stale path ---"
REFRESH=$(curl -sS "$BASE/api/lobby/snapshot?eventId=$EVENT_ID" \
  -H "x-lobby-as: host" \
  -H "x-lobby-host-secret: $HOST_SECRET")
echo "$REFRESH" | python3 -c "
import sys,json
s=json.load(sys.stdin)
for p in s.get('presence',[]):
  if p['userId'] in ('$TAB_BOT','$CURL_BOT'):
    print('presence:', p['userId'][:12], 'state=', p.get('state'))
"

# --- Test 3: Gateway CORS from curl (simulating browser fetch) ---
echo "--- Gateway probes ---"
for port in 1340 4521; do
  echo -n "port $port /health: "
  curl -sS -m 2 -o /dev/null -w "http=%{http_code} connect=%{errormsg}\n" \
    -H "Origin: http://127.0.0.1:4521" \
    "http://127.0.0.1:${port}/health" 2>&1 || true
done

# CORS preflight simulation
echo "--- CORS preflight to :1340 ---"
curl -sS -m 2 -X OPTIONS "http://127.0.0.1:1340/health" \
  -H "Origin: http://127.0.0.1:4521" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null 2>&1 | head -20 || echo "preflight failed (expected if no gateway)"

# Production origin CORS test
echo "--- Production origin fetch to local gateway (should fail) ---"
curl -sS -m 2 -o /dev/null -w "prod->local1340 http=%{http_code}\n" \
  -H "Origin: https://grok-bot-lobby.teamdeel.workers.dev" \
  "http://127.0.0.1:1340/health" 2>&1 || echo "blocked"

echo "=== DONE ==="
echo "EVENT_CODE=$CODE"
echo "TAB_BOT=$TAB_BOT"
echo "CURL_BOT=$CURL_BOT"
