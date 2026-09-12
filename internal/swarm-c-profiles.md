---
subagentId: bc-8a1ec800-756f-5579-aa29-94d020cc3319
swarm: C
topic: profiles
---

# Swarm C — Profiles

## Delivered

| Item | Path |
|------|------|
| Domain types | `BotProfile` / `LumaProfile` in `src/lib/domain.ts` — luma, GitHub, Origin handles + URLs |
| Fetch/cache | `src/lib/profile-fetch.ts` — GitHub API; Luma/Origin best-effort bio |
| Apply + persist | `src/lib/lobby-profiles.ts` → `LobbyMemory.updateProfile`; DO `PersistedLobbyState.profiles` |
| API | `POST /api/bots/profile`, `POST /api/profile/enrich` |
| Claim inputs | Optional profile fields on `parseClaimBody` |
| Detail panel | `context-panel.tsx` — gh/, origin/, luma/ links |

## Persistence

Profiles stored in Durable Object state map `profiles: Array<[userId, BotProfile]>` via `toPersisted()` / `fromPersisted()`.

## Note

GitHub public API used without token (rate-limited). Production enrichment is best-effort; handles always persist even if fetch fails.
