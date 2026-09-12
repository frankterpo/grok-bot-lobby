# GitHub repo check (2026-09-12)

- Configured remote: `https://github.com/franciscoterpolilli/grok-bot-lobby.git`
- `git ls-remote origin HEAD` → **Repository not found** (404)
- `git push -u origin cursor/grok-bot-lobby-4541` → same 404
- GitHub MCP: no public repo named `grok-bot-lobby` under `franciscoterpolilli` or `frankterpo`

Clone URL in templates/docs uses the configured remote. Host must create/publish the repo before guests can clone.
