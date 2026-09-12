# Swarm B — Social / onboarding

## Status

Already implemented on branch; verified paths:

| Feature | API / UI |
| --- | --- |
| Squad invite (outbound) | `POST /api/squads/invite` + ContextPanel "Invite to Group" |
| Squad request (inbound) | `POST /api/squads/request` + "Request to join" |
| Token exchange | propose / approve / reject routes + `TokenExchanges` panel |
| Share levels | `label`, `label+status`, `full` + `TokenShareToggle` |
| Guest wizard | `event-share-wizard.tsx` — clone URL, join message, `join-lobby` one-liner |

Guest wizard polish: repo clone URL, public origin chip, tunnel fallback retained.
