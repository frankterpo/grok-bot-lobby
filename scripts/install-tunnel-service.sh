#!/usr/bin/env bash
# Install cloudflared as a macOS LaunchAgent (survives logout/reboot).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/cloudflared/config.yml"
PLIST_LABEL="com.cloudflare.grok-bot-lobby"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TUNNEL_NAME="grok-bot-lobby"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "LaunchAgent install is macOS-only. See docs/persistent-tunnel.md for systemd." >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG — run: npm run tunnel:setup" >&2
  exit 1
fi

CLOUDFLARED="$(command -v cloudflared || true)"
if [[ -z "$CLOUDFLARED" ]]; then
  echo "cloudflared not found in PATH" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${CLOUDFLARED}</string>
    <string>tunnel</string>
    <string>--config</string>
    <string>${CONFIG}</string>
    <string>run</string>
    <string>${TUNNEL_NAME}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/cloudflared-grok-bot-lobby.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/cloudflared-grok-bot-lobby.err</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/${PLIST_LABEL}"
launchctl kickstart -k "gui/$(id -u)/${PLIST_LABEL}"

echo "Installed LaunchAgent: $PLIST_DEST"
echo "Logs: ~/Library/Logs/cloudflared-grok-bot-lobby.{log,err}"
echo "Status: launchctl print gui/$(id -u)/${PLIST_LABEL}"
