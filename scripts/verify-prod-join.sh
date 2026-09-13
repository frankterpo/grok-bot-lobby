#!/usr/bin/env bash
set -euo pipefail

PROD_ORIGIN="${PROD_ORIGIN:-https://grok-bot-lobby.teamdeel.workers.dev}"
URL="${1:-$PROD_ORIGIN/join/TEST}"
PROD_CODE="${PROD_CODE:-8EDRWX7K}"

HTML=$(curl -sS "$URL")

if echo "$HTML" | grep -q "Three steps"; then
  echo "FAIL: prod still shows old three-step UX"
  exit 1
fi

if ! echo "$HTML" | grep -q "Join lobby"; then
  echo "FAIL: expected 'Join lobby' heading not found"
  exit 1
fi

if ! echo "$HTML" | grep -q "Download Mac helper"; then
  echo "FAIL: expected Mac helper download not found"
  exit 1
fi

if ! echo "$HTML" | grep -q 'HELPER_DIR=.*local-join-bridge'; then
  echo "FAIL: bootstrap one-liner (HELPER_DIR + local-join-bridge) not found in page"
  exit 1
fi
echo "Bootstrap one-liner present in join wizard HTML"

# Live prod event (host-created) — API snapshot, not SSR text
echo "--- Prod event snapshot ($PROD_CODE) ---"
SNAP=$(curl -sS "$PROD_ORIGIN/api/lobby/snapshot?code=$PROD_CODE")
echo "$SNAP" | python3 -c "
import sys, json
s = json.load(sys.stdin)
e = s.get('event')
assert e and e.get('id'), s
print('PASS: prod code', e.get('eventCode', '?'), 'is live (eventId=' + e['id'] + ')')
"

# Invalid code API returns null event (wizard shows client-side warning)
echo "--- Invalid code snapshot ---"
BAD=$(curl -sS "$PROD_ORIGIN/api/lobby/snapshot?code=ZZZZZZZZ")
echo "$BAD" | python3 -c "
import sys, json
s = json.load(sys.stdin)
assert s.get('event') is None, s
print('PASS: invalid code ZZZZZZZZ has no event')
"

echo "PASS: prod join wizard deployed at $URL"
