# Cloudflare deploy (2026-09-12)

- **URL:** https://grok-bot-lobby.teamdeel.workers.dev
- **Stack:** OpenNext `@opennextjs/cloudflare` + custom-worker exporting `LobbyStoreDO`
- **State:** Durable Object (`LOBBY_STORE`, sqlite migration `v1`)
- **Deploy:** `npm run deploy` (requires `npx wrangler login`)

Free plan requires `new_sqlite_classes` in wrangler migrations (not `new_classes`).
