import type { LobbyToken, ShareLevel, TokenStatus } from "@/lib/domain";

export const TASK_LABEL_MAX = 80;

export function truncateTaskLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= TASK_LABEL_MAX) {
    return trimmed;
  }
  return trimmed.slice(0, TASK_LABEL_MAX);
}

export function tokensEqual(a: LobbyToken, b: Omit<LobbyToken, "timestamp">): boolean {
  return (
    a.botId === b.botId &&
    a.eventId === b.eventId &&
    a.taskLabel === b.taskLabel &&
    a.status === b.status &&
    (a.focus ?? "") === (b.focus ?? "") &&
    a.shareLevel === b.shareLevel
  );
}

export function buildToken(input: {
  botId: string;
  eventId: string;
  taskLabel: string;
  status: TokenStatus;
  focus?: string;
  shareLevel: ShareLevel;
}): LobbyToken {
  return {
    botId: input.botId,
    eventId: input.eventId,
    taskLabel: truncateTaskLabel(input.taskLabel),
    status: input.status,
    focus: input.focus?.trim() || undefined,
    timestamp: new Date().toISOString(),
    shareLevel: input.shareLevel,
  };
}
