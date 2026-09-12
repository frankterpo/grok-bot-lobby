# Grok Bot mark asset hunt

## Sources searched

| Location | Result |
|---|---|
| `grok-bot-lobby` repo | No prior mark assets |
| `~/.agents/skills/grok-bot/` | CLI skill only; no SVG/CSS |
| `~/.cursor/skills/grok-bot/` | Not installed |
| `~/Library/Application Support/Grok Bot/` | Electron cache/prefs only |
| `/Applications/Grok Bot.app/Contents/Resources/app.asar` | **Hit** — renderer bundle |

## Extracted from `app.asar`

File: `dist/renderer/assets/index-C57MhV1e.js`

- **viewBox:** `-15 -15 259 259` (`Vh` constant)
- **Head path (`EPe`):** `M228.541 114.228C228.541 130.133...` (blob silhouette)
- **Eyes:** rest-state polygon rings from `Xc[0]` (left/right slanted pills)
- **Fill pattern:** `--fg` on head, `--bg` on eyes (`I8`/`PF` style objects)
- **In-app class:** `sand-grok-bot-mark` (not `grok-bot-lazy`)

## Not found

- `grok-bot-lazy`, `baby-grok-bot`, `grok-bot-mark--fill`, `grok-bot-mark__head` as DOM class strings in desktop bundle (marketing-site naming; geometry matches)
- CSS `@keyframes` for mark motion — desktop uses rAF pose morphing in `mLe` component (`state: "working"` triggers spin/bounce/eye morph)

## Lobby implementation

- `GrokBotMark` ports head + eye paths with `grok-bot-mark--fill` CSS vars
- Working animation: minimal CSS bob (`grok-bot-lazy-bob`, `grok-bot-lazy-eye`) when `presence.state === 'active'` && `token.status === 'working'`
