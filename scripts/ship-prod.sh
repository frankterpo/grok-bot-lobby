#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is required." >&2
  echo "Create a token at https://developers.cloudflare.com/fundamentals/api/get-started/create-token/" >&2
  echo "Scopes: Account / Workers Scripts / Edit" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "ERROR: CLOUDFLARE_ACCOUNT_ID is required." >&2
  exit 1
fi

echo "Building and deploying grok-bot-lobby to Cloudflare Workers..."
npm run deploy

echo "Verify join wizard at:"
echo "  https://grok-bot-lobby.teamdeel.workers.dev/join/TEST"
echo "Expected: 'Join lobby' heading + Mac helper download (NOT 'Three steps')"
bash scripts/verify-prod-join.sh
bash scripts/verify-prod-community.sh
