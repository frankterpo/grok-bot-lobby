# Grok bot idle animation — group vs solo unification

## Why group cluster felt better

| Factor | Group cluster | Solo grid (before) |
|--------|---------------|-------------------|
| Mark size | ~24px discs (`(44×5)/9`) | 56px (`size="lg"`) |
| Rest tier | compact (reference) | same CSS → ~2.3× pixel motion |
| Stagger | 3 colors + index seed | color-only hash (could sync) |
| Look-around | subtle at 24px | obvious loop at 56px |
| Special CSS | `drop-shadow` only (visual, not motion) | none |

Same `GrokBotMark` + globals.css applied everywhere; no group-only animation override.

## What changed

1. **Size tiers** on `GrokBotMark`: `rest-compact` (≤35px), `rest-medium` (36–47), `rest-large` (≥48).
2. **Compact** keeps prior toned-down keyframes (10s breathe, 24s look, 14/17s blink) — matches cluster discs and sidebar (28px).
3. **Medium/large** use amplitude scaled to ~24px reference; **large disables look-around** (blink + faint breathe only).
4. **`restSeed` prop** — solo/sidebar use `attendee.id`; cluster uses `${color}-${index}` for per-disc desync.
5. **`prefers-reduced-motion: reduce`** — unchanged (all animations off).

## Verified

- `tsc --noEmit` clean
- `:4521` — cluster discs 24.4px → `rest-compact` + staggered delays; solo 56px → `rest-large`
