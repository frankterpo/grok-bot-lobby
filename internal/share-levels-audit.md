# Share levels audit (grok-bot-skill vs lobby)

Date: 2026-09-12

## grok-bot-skill transcript model

Source: https://github.com/adamanz/grok-bot-skill (`scripts/grokbot.py`)

The skill has **no transcript privacy tiers**. Commands:

| Command | Exposed fields |
|---------|----------------|
| `list` | id, name, title, description (truncated), isActive, isRunning, lastMessagePreview (truncated), … |
| `transcript` | agent summary + entries: id, kind, author, **full text** |
| `chat` | new transcript entries with full text |

`transcript --limit N` always returns complete entry text to the caller. There is no task-name-only mode in the skill CLI.

## Lobby task-token model

The lobby does **not** sync Grok Bot transcripts. It syncs **task tokens** via:

- `POST /api/lobby/sync` — `taskLabel`, `status`, optional `focus`, `shareLevel`
- `scripts/sync-token.ts` — passes `--shareLevel` (default `label+status`)
- `scripts/join-lobby.ts` — passes `--shareLevel` on initial sync when `--task` is set

Standing rules (`docs/grok-bot-standing-rules.md`) match lobby prefs:

> The lobby sees tokens only — never the full workspace, not Agent Computer, not files.

## Lobby share levels (`ShareLevel`)

| Enum | UI label | Others see |
|------|----------|------------|
| `label` | Task label only | `taskLabel` only (status masked, no focus) |
| `label+status` | Task + status | `taskLabel` + `status` (no focus) |
| `full` | Task + status + focus | `taskLabel` + `status` + `focus` |

When `shareTokens` is off, others see nothing (`shouldPresentToken` returns false).

Filtering: `lobby-store.ts` → `presentToken()` redacts fields per level before snapshot.

## Task-name-only?

**Yes, in the lobby** via `shareLevel: "label"`. This is task-token privacy, not transcript privacy.

**No, in grok-bot-skill** — `transcript` always returns full message text to the agent running the CLI.

## Gap

If users want “task name only” from the **Grok Bot conversation**, that must be enforced by the agent (summarize, don’t paste transcript) per SKILL.md — not by a skill flag. The lobby toggle controls what **other lobby attendees** see on cards/detail, not what the Grok Bot CLI returns locally.
