# x.ai baby-grok-bot palette audit

Extracted from https://x.ai (light mode `.baby-grok-bot-transcript` CSS vars) and inverted for dark lobby (`#0d0d0d`).

## x.ai source tokens (light)

| Token | Value | Usage |
|-------|-------|-------|
| `--grok-bot-sidebar-selected` | `#0a0a0a0e` | Active agent row bg |
| `--grok-bot-sidebar-hover` | `#0a0a0a0a` | Row hover |
| `--grok-bot-bg-active` / `--cursor-bg-active` | `#00000014` | Active surfaces |
| `--cursor-bg-hover` | `#0000000a` | Hover surfaces |
| `--grok-bot-border-default` | `#0000001a` | Subtle borders |
| `--grok-bot-sidebar-separator` | `#14141426` | Dividers |
| `--grok-bot-sidebar-text-primary` | `#141414` | Primary text |
| `--grok-bot-sidebar-text-secondary` | `#14141499` | Secondary text |
| `--grok-bot-sidebar-text-tertiary` | `#14141466` | Muted labels |
| `--cursor-text-accent` / `--grok-bot-text-accent` | `#0a84ff` | Interactive accent (blue) |
| `--grok-bot-fill-emphasis` | `#111110` | Primary buttons (dark fill) |

No amber/gold accent in baby-grok-bot UI.

## Dark lobby mapping (`globals.css`)

| Token | Value |
|-------|-------|
| `--grok-sidebar-selected` | `#ffffff14` |
| `--grok-sidebar-hover` | `#ffffff0a` |
| `--grok-bg-active` | `#ffffff14` |
| `--grok-border-subtle` | `#ffffff1a` |
| `--grok-text-accent` | `#0a84ff` |
| `--primary` | `#e8e8e8` |
| `--ring` / `--sidebar-ring` | `#ffffff40` |

## Verified in browser (:4521)

- Active event row: `rgba(255,255,255,0.08)` bg, transparent border (was gold border)
- DetailHeader "You": `white/40` (was `#f59e0b`)
- Inbox badge: `white/80` on dark text (was amber pill)

## Amber removals

All `#f59e0b` UI usages removed from `src/` except `BOT_COLORS.amber` in `domain.ts` (user-selectable bot swatch, not chrome accent).

Files touched: `globals.css`, `lobby-sidebar.tsx`, `context-panel.tsx`, `lobby-app.tsx`, `onboarding-screen.tsx`, `bot-grid.tsx`, `grok-bot.tsx`, `token-composer.tsx`, `join-flow.tsx`, `presence-dot.tsx`, `create-event-dialog.tsx`, `token-exchanges.tsx`, `join/page.tsx`, `permissions-walkthrough.tsx`, `event-code-chip.tsx`, `share-link.tsx`.
