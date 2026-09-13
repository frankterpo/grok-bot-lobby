#!/usr/bin/env bash
# Post-deploy probe for all 10 community-fix items on prod.
set -euo pipefail

BASE="${1:-https://grok-bot-lobby.teamdeel.workers.dev}"
FAIL=0

check_route() {
  local label="$1"
  local method="$2"
  local path="$3"
  local expect="$4"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d '{}')
  if [[ "$code" == "$expect" ]]; then
    echo "PASS: $label ($method $path → $code)"
  else
    echo "FAIL: $label ($method $path → $code, expected $expect)"
    FAIL=1
  fi
}

echo "=== Community prod verification @ $BASE ==="

# Routes must exist (403/400 = deployed, 404 = not deployed)
check_route "host kick API" POST /api/bots/kick 403
check_route "squad respond API" POST /api/squads/respond 403
check_route "lobby prompt API" POST /api/lobby/prompt 403

# Join wizard + invalid code (includes API snapshot checks)
bash "$(dirname "$0")/verify-prod-join.sh" "$BASE/join/TEST"

# Client-side banner (requires community-fix deploy with eventLive join-wizard)
HTML=$(curl -sS "$BASE/join/ZZZZZZZZ")
if echo "$HTML" | grep -qE "isn't a live lobby|isn.t a live lobby"; then
  echo "PASS: invalid join code client banner"
elif echo "$HTML" | grep -qi "invalid"; then
  echo "WARN: invalid code partial (SSR only; redeploy for client banner)"
else
  echo "FAIL: invalid join code UX missing"
  FAIL=1
fi

# Profile enrich (existing route)
ENRICH=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/api/profile/enrich" \
  -H 'Content-Type: application/json' -d '{"githubHandle":"octocat"}')
if [[ "$ENRICH" == "200" ]]; then
  echo "PASS: profile enrich ($ENRICH)"
else
  echo "FAIL: profile enrich ($ENRICH)"
  FAIL=1
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo "PASS: all community prod probes"
  exit 0
fi
echo "FAIL: one or more community prod probes failed"
exit 1
