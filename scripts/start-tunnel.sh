#!/usr/bin/env bash
# Run the named grok-bot-lobby tunnel (NOT ephemeral trycloudflare).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/cloudflared/config.yml"
TUNNEL_NAME="grok-bot-lobby"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install: brew install cloudflared" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  cat >&2 <<EOF
Missing $CONFIG

Run one-time setup first:
  npm run tunnel:setup

For a throwaway demo URL (ephemeral, not for production):
  npm run tunnel:quick
EOF
  exit 1
fi

echo "Starting named tunnel ($TUNNEL_NAME) -> http://127.0.0.1:4521"
echo "Config: $CONFIG"
exec cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME"
