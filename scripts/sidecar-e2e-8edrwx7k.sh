#!/usr/bin/env bash
# Sidecar E2E against a live code (default 8EDRWX7K) or a freshly created local event.
set -euo pipefail

CODE="${CODE:-8EDRWX7K}"
BASE="${BASE:-https://grok-bot-lobby.teamdeel.workers.dev}"
SIDECAR="${SIDECAR:-http://127.0.0.1:9139}"
NAME="${NAME:-SidecarE2E}"
TASK="${TASK:-Sidecar E2E heartbeat}"

echo "=== Sidecar E2E ==="
echo "BASE=$BASE CODE=$CODE SIDECAR=$SIDECAR"

SNAP=$(curl -sS "$BASE/api/lobby/snapshot?code=$CODE" -H "x-lobby-as: attendee" || true)
LIVE=$(python3 - <<PY
import json,sys
raw='''$SNAP'''
try:
    d=json.loads(raw)
except Exception:
    print("no")
    raise SystemExit
event=d.get("event") or {}
print("yes" if event.get("id") else "no")
print(event.get("id",""))
print(event.get("eventCode",""))
PY
)
LIVE_FLAG=$(echo "$LIVE" | sed -n '1p')
EVENT_ID=$(echo "$LIVE" | sed -n '2p')
echo "EVENT_LIVE=$LIVE_FLAG EVENT_ID=$EVENT_ID"

if [[ "$LIVE_FLAG" != "yes" ]]; then
  echo "ISSUES: event $CODE is not live on $BASE"
  exit 2
fi

HEALTH=$(curl -sS "$SIDECAR/health" || true)
python3 - <<PY
import json,sys
raw='''$HEALTH'''
d=json.loads(raw)
assert d.get("ok"), d
print("SIDECAR_OK", d.get("version"))
PY

JOIN=$(curl -sS -X POST "$SIDECAR/join" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE" \
  -d "{\"code\":\"$CODE\",\"url\":\"$BASE\",\"name\":\"$NAME\",\"task\":\"$TASK\",\"color\":\"cyan\"}")
echo "JOIN=$JOIN"
python3 - <<PY
import json
d=json.loads('''$JOIN''')
assert d.get("ok"), d
print("USER", d.get("userId"), "PID", d.get("pid"))
PY

echo "PASS: sidecar joined live code $CODE"
