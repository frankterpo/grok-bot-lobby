# Persistent Cloudflare Tunnel

Remote Grok Bot users need a **stable HTTPS URL** that survives restarts. Use a **named tunnel** (Zero Trust / `cloudflared`), not ephemeral `trycloudflare.com` quick tunnels.

Quick tunnels (`npm run tunnel:quick`) are fine for one-off demos only — the URL changes every run and dies when the process stops.

## Architecture

```
Internet  →  Cloudflare edge  →  named tunnel (fixed UUID)  →  http://127.0.0.1:4521
```

- **Tunnel name:** `grok-bot-lobby` (persistent object in your Cloudflare account)
- **Origin:** Next.js dev server on port **4521**
- **Credentials:** `~/.cloudflared/<TUNNEL_UUID>.json` (never commit)
- **Config:** `cloudflared/config.yml` (generated locally, gitignored)

## One-time setup (host machine)

### Prerequisites

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) installed (`brew install cloudflared`)
- Cloudflare account with **Zero Trust** (free tier works)
- A domain on Cloudflare (for a stable hostname like `lobby.yourdomain.com`)

### 1. Create named tunnel + DNS

```bash
cd /path/to/grok-bot-lobby
npm run tunnel:setup -- --hostname lobby.yourdomain.com --zone yourdomain.com
```

This runs:

1. `cloudflared tunnel login` (browser, once per machine)
2. `cloudflared tunnel create grok-bot-lobby`
3. `cloudflared tunnel route dns grok-bot-lobby lobby.yourdomain.com`
4. Writes `cloudflared/config.yml`

**No Cloudflare zone?** You can still create the tunnel and add a **Public Hostname** manually in [Zero Trust → Networks → Tunnels](https://one.dash.cloudflare.com/) pointing to `http://127.0.0.1:4521`. You must attach *some* hostname (your domain or a subdomain you control) — there is no stable public URL without DNS routing.

### 2. Pin join links to the public URL

```bash
cp .env.local.example .env.local
# Set LOBBY_PUBLIC_URL and NEXT_PUBLIC_LOBBY_PUBLIC_URL to https://lobby.yourdomain.com
```

Restart dev after editing.

### 3. Install tunnel as a background service (macOS)

```bash
npm run tunnel:install
```

Installs `~/Library/LaunchAgents/com.cloudflare.grok-bot-lobby.plist` — starts at login, restarts on crash.

**Logs:** `~/Library/Logs/cloudflared-grok-bot-lobby.{log,err}`

**Remove service:**

```bash
npm run tunnel:uninstall
```

### Linux (systemd)

After `npm run tunnel:setup`:

```bash
sudo cloudflared --config /path/to/grok-bot-lobby/cloudflared/config.yml service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Or use the token from Zero Trust dashboard:

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
```

## Daily operation

**Terminal 1 — dev server (required; in-memory lobby state lives here):**

```bash
npm run dev
```

**Terminal 2 — tunnel (skip if launchd/systemd service is running):**

```bash
npm run tunnel
```

**Check tunnel service (macOS):**

```bash
launchctl print gui/$(id -u)/com.cloudflare.grok-bot-lobby
cloudflared tunnel info grok-bot-lobby
```

## Copy-paste for remote joiner

Replace `lobby.yourdomain.com` with your stable hostname:

```
Join lobby COLOOP at https://lobby.yourdomain.com/join/COLOOP
```

**CLI (Alice, in this repo):**

```bash
npm run join-lobby -- \
  --code COLOOP \
  --url https://lobby.yourdomain.com \
  --name Alice \
  --color cyan \
  --task "Setting up event credits"
```

## Credentials & security

| Item | Location | Commit? |
| --- | --- | --- |
| Tunnel UUID | `cloudflared/config.yml` | No (gitignored) |
| Tunnel credentials | `~/.cloudflared/<UUID>.json` | **Never** |
| Origin cert (login) | `~/.cloudflared/cert.pem` | **Never** |
| Public URL | `.env.local` | No |

Rotate or delete tunnels in Zero Trust → Networks → Tunnels.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing cloudflared/config.yml` | Run `npm run tunnel:setup` |
| `Cannot determine default origin certificate` | Run `cloudflared tunnel login` |
| Join link shows localhost | Set `LOBBY_PUBLIC_URL` in `.env.local`, restart dev |
| 502 / tunnel up but app down | Start `npm run dev` on :4521 |
| DNS not resolving | Check `cloudflared tunnel route list`; verify CNAME in Cloudflare DNS |

## Future: true serverless persistence

The host machine must run for in-memory lobby state. For uptime without a laptop, deploy to **Cloudflare Pages** with KV/D1 backing — see [remote-join.md](./remote-join.md#persistent-deploy-future).
