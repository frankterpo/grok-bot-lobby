# Grok bot working rainbow sweep — x.ai audit

## x.ai technique (baby-grok-bot / LazyGrokBot)

Source: `https://x.ai/_next/static/chunks/0ow9g96xjl_hd.js` + live DOM on `/bot`.

1. **Not CSS** — `requestAnimationFrame` particle/trail engine (`eH`) inside the SVG.
2. **`data-state="working"`** on `svg.grok-bot-mark`; head/eyes morph via rAF pose system.
3. **Rainbow lines** = orbital "belt" particles during spin; each emits:
   - `path[data-trail]` with morphing `d` (thick curved band)
   - Per-trail `linearGradient` (`gradientUnits="userSpaceOnUse"`) with 5 stops
   - Stop colors: `hsl(${(hue + r*span) % 360} 56% ${56 + 11*r}%)`
4. Trails render in `g[aria-hidden="true"]` **above** head + eyes; head uses `clipPath` on eye group only.
5. Working state enables `sustainBelts` while spin velocity ≥ threshold.

## Lobby port (CSS/SVG stand-in)

- `GrokBotMark`: `clipPath` on head; 4 diagonal `rect.grok-bot-mark__sweep-band` with x.ai-like HSL gradients (214/297/13/106° bases).
- `globals.css`: `grok-bot-sweep-band` keyframes translate bands across viewBox; staggered `--grok-bot-sweep-delay`.
- Keeps existing `grok-bot-work-bob` + `grok-bot-work-eye`; resting tiers unchanged.
- No amber — rainbow uses x.ai HSL belt palette only.

## Verified

- `tsc --noEmit` clean
- `:4521` — 6 working marks, 24 animated sweep bands
- Screenshots: `media/xai-working-reference.png`, `media/lobby-working-rainbow.png`
