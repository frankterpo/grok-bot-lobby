# Swarm C — Profiles

## Delivered

- **Inputs**: Luma, GitHub, Origin URLs/handles on `User` + claim body.
- **Fetch/cache**: `src/lib/profile-fetch.ts` — 15m cache, GitHub API bio, handle parsing.
- **Persist**: profiles map in Durable Object via `applyProfileInputs` / `updateProfile`.
- **API**: `POST /api/bots/profile`.
- **Detail panel**: `context-panel.tsx` shows luma/gh/origin handles + cached bio.

## Usage

```bash
npm run join-lobby -- --code CODE --url URL --name Alice --githubHandle octocat
# or POST /api/bots/profile with eventId, botId, githubProfileUrl, etc.
```
