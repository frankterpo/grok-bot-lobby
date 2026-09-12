#!/usr/bin/env bash
set -euo pipefail

PLIST_LABEL="com.cloudflare.grok-bot-lobby"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "LaunchAgent uninstall is macOS-only." >&2
  exit 1
fi

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
rm -f "$PLIST_DEST"
echo "Removed $PLIST_DEST"
