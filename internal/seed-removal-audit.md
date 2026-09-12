# Seed removal audit

## Where seed was injected

- `src/lib/seed.ts` → `buildSeed()` called from `LobbyMemory.loadSeed()` in `lobby-store.ts` on singleton init.
- Fallbacks: `snapshot()` defaulted to `SEED_EVENT_ID`; `session.ts` and `bot-auth.ts` defaulted to `event_coloop`.
- UI: onboarding **Open host lobby** loaded pre-seeded CoLoop; `client.defaultJoinCode()` returned `COLOOP`.
- Scripts: `join-lobby.ts` defaulted `--code` to `COLOOP`.

## What broke without seed (fixed)

| Area | Before | After |
| --- | --- | --- |
| Fresh load | CoLoop pre-loaded | Empty sidebar; create-event dialog auto-opens for host |
| Snapshot | Always had event | `event: null` until create or select |
| join-lobby | `--code` optional | `--code` required |
| Attendee switch | `/join/COLOOP` | `/join` or remembered code |

## SEED_DEMO flag

`SEED_DEMO=1 npm run dev` restores CoLoop Cowork + demo squads for local demos only.
