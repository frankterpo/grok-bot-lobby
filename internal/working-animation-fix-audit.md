# Working animation fix audit

## Trigger logic

### Before
- Duplicated inline: `presenceState(presence, now) === "active" && token?.status === "working"`
- Used in `bot-card.tsx`, `bot-grid.tsx`, `context-panel.tsx`, `lobby-app.tsx`
- Seed host Francisco: `status: "working"` + `lastHeartbeat: now` + `claimed: true` → always animated on load

### After
- Central `isBotWorking(presence, token, now)` in `domain.ts` with documented gate:
  1. Claimed + heartbeat within `STALE_AFTER_MS` (90s)
  2. Token status `"working"`
  3. Offline/stale/unclaimed demo bots fail via #1
- Seed host Francisco: `status: "idle"` (hosting, not mid-task)

## Animation

- **Removed** rainbow belt SVG + `grok-bot-belt-orbit` CSS entirely
- **Kept** minimal working motion: faster bob (1.8s) + eye drift (1.6s) via `grok-bot-mark--working`

## Browser verify (:4521)

- Francisco: resting only (`franciscoWorking: 0`)
- Bob (join-lobby `--status working`): working bob only (`bobWorking: 1`)
- Rainbow belts in DOM: `0`
