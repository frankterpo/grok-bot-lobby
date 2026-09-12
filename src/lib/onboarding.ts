import type { ChecklistItem, Event, LobbyToken, SessionView } from "@/lib/domain";
import { HOST_USER_ID } from "@/lib/domain";

export type { ChecklistItem };

export const CHECKLIST_COPY: readonly { id: ChecklistItem["id"]; label: string }[] = [
  {
    id: "open-event",
    label: "Install Grok Bot, then host opens the lobby",
  },
  {
    id: "copy-code",
    label: "Copy the event code + lobby URL",
  },
  {
    id: "second-join",
    label: "Tell your Grok Bot: Join lobby CODE at URL",
  },
  {
    id: "claim-bot",
    label: "Bot claims via join-lobby (permissions in standing rules)",
  },
  {
    id: "both-appear",
    label: "Confirm both bots are in the grid",
  },
  {
    id: "set-token",
    label: "Sync a task token so the room can see what you're on",
  },
  {
    id: "squad",
    label: "Invite / request a squad, or propose a token exchange",
  },
];

export const PERMISSIONS_COPY = [
  {
    id: "show-bot",
    title: "Show my bot in this event",
    body: "I sit in the grid as you. One bot per person. Cute, tinted, labeled YOU when it's yours.",
  },
  {
    id: "task-label",
    title: "Share what I'm working on",
    body: "A short task label. That's the token. Not your files, not the chat, not Agent Computer.",
  },
  {
    id: "status",
    title: "Share status",
    body: "working / done / waiting / idle — so the room knows if I'm mid-task or parked.",
  },
  {
    id: "heartbeat",
    title: "Heartbeat while I'm here",
    body: "I ping every 30s while this tab is open. Go quiet and I show “no activity”. Close the tab and the card stays: “bot not active”.",
  },
] as const;

export const TOKEN_PRIVACY_LINE =
  "The lobby sees tokens only — never your full workspace. You can reopen this from YOU → Edit.";

export function deriveChecklist(args: {
  event: Event | null;
  session: SessionView;
  tokens: LobbyToken[];
  shareCopied: boolean;
  claimedUserIds: string[];
}): ChecklistItem[] {
  const { event, session, tokens, shareCopied, claimedUserIds } = args;
  const selfPresent = Boolean(
    event && session.userId && event.attendees.some((attendee) => attendee.id === session.userId),
  );
  const ownToken = Boolean(
    session.userId &&
      tokens.some((token) => token.botId === session.userId && token.taskLabel.trim().length > 0),
  );
  const inSquad = Boolean(
    event &&
      session.userId &&
      event.attendees.some((attendee) => attendee.id === session.userId && attendee.squadId),
  );
  const hostClaimed = claimedUserIds.includes(HOST_USER_ID);
  const bothAppear = claimedUserIds.length >= 2 && hostClaimed;

  const done: Record<ChecklistItem["id"], boolean> = {
    "open-event": event !== null,
    "copy-code": shareCopied,
    "second-join": bothAppear,
    "claim-bot": session.claimed && selfPresent,
    "both-appear": bothAppear,
    "set-token": ownToken,
    squad: inSquad,
  };

  return CHECKLIST_COPY.map((item, index) => ({
    id: item.id,
    step: index + 1,
    label: item.label,
    done: done[item.id],
  }));
}
