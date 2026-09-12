# Grok bot working rainbow orbit — x.ai audit + fix

## x.ai technique (baby-grok-bot / LazyGrokBot)

Source: `https://x.ai/_next/static/chunks/0ow9g96xjl_hd.js` + live DOM on `/bot`.

1. **Not CSS** — `requestAnimationFrame` particle/trail engine (`eH`) inside the SVG.
2. **`data-state="working"`** on `svg.grok-bot-mark`; head/eyes morph via rAF pose system.
3. **Rainbow lines** = orbital "belt" particles during spin; each emits:
   - `path[data-trail]` with morphing `d` (thick curved band)
   - Per-trail `linearGradient` (`gradientUnits="userSpaceOnUse"`) with 5 stops
   - Stop colors: `hsl(${(hue + r*span) % 360} 56% ${56 + 11*r}%)`
4. Trails render in `g[aria-hidden="true"]` above head + eyes; `beltRadius` controls orbit inset.
5. Working state enables `sustainBelts` while spin velocity ≥ threshold.

## What was wrong (commit a218067)

- Port used **diagonal `rect` bands** clipped to the head and animated with `translateX` across the face.
- Looked like flat rainbow overlays crossing the eyes — not an orbital belt wrapping the blob circumference.

## Lobby fix (orbital arc CSS/SVG stand-in)

- **`GrokBotMark`**: 4 elliptical arc paths (`grok-bot-mark__belt-arc`) on orbit rx=92 ry=88 around centroid (114.5, 114.5).
- Each arc in a rotating `<g class="grok-bot-mark__belt-orbit">` with staggered `--grok-bot-belt-start` / `--grok-bot-belt-delay`.
- Rainbow via per-band `linearGradient` (x.ai HSL bases 214/297/13/106°).
- Belts render **above eyes**; orbit radius keeps strokes on the perimeter — face/eyes stay clear.
- **`globals.css`**: `grok-bot-belt-orbit` keyframes rotate 360° around head center.

## Verified

- `tsc --noEmit` clean
- `:4521` — working marks show rainbow arcs hugging head edge (see `media/lobby-working-orbit*.png`)
