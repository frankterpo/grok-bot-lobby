#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://grok-bot-lobby.teamdeel.workers.dev/join/TEST}"
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

echo "PASS: prod join wizard deployed at $URL"
