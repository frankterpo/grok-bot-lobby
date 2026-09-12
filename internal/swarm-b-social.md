---
subagentId: bc-8a1ec800-756f-5579-aa29-94d020cc3319
swarm: B
topic: social-onboarding
---

# Swarm B — Social / onboarding

## Delivered (verified in codebase)

| Feature | Routes / UI |
|---------|-------------|
| Outbound squad invite | `POST /api/squads/invite` — organizer/host invites attendee |
| Inbound squad request | `POST /api/squads/request` — open squads |
| Leave squad | `POST /api/squads/leave` |
| Token exchange | `POST /api/token-exchange/propose`, `approve`, `reject` |
| Share levels | `label` / `label+status` / `full` — `presentToken` redaction in `lobby-store-present.ts`; audit in `internal/share-levels-audit.md` |
| Guest wizard | `event-share-wizard.tsx`: clone → `npm install` → `npx skills add adamanz/grok-bot-skill` → `join-lobby` |

## Gaps closed

- Guest message now includes grok-bot-skill install step before join command.
- Remote join docs require repo clone (`docs/remote-join.md`).

## Policy

`src/lib/policy.ts`: `canInviteToSquad`, `canRequestJoin`, `canResolveExchange` gate social actions.
