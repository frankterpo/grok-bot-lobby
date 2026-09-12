# Event share wizard

Replaced amber ShareLink banner with `EventShareWizard` in create-event post-create dialog.

## Steps
1. Create event — green check, event name + date
2. Public URL — polls `GET /api/lobby/public-url` every 4s; tunnel setup commands when not configured
3. Share link — copy enabled when `shareable: true`
4. Send to guest — message template copy when shareable

## Verified
- Browser :4521 — create event → wizard shows all four steps
- Step 3/4 disabled with localhost when env unset
- `tsc --noEmit` passes
