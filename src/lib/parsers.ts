import {
  isShareLevel,
  isTokenStatus,
  parseBotColor,
  TASK_LABEL_MAX,
  type ShareLevel,
  type TokenStatus,
} from "@/lib/domain";
import { asBoolean, asString, isRecord } from "@/lib/http";

export type ClaimBody = {
  eventCode: string;
  name: string;
  botColor: string;
  shareLevel: ShareLevel;
  hasGrokBot: boolean;
  acceptPermissions: boolean;
  lumaHandle?: string;
  lumaProfileUrl?: string;
  githubHandle?: string;
  originUsername?: string;
};

export type ProfileBody = {
  eventId: string;
  lumaHandle?: string;
  lumaProfileUrl?: string;
  githubHandle?: string;
  originUsername?: string;
};

export type SyncBody = {
  eventId: string;
  botId: string;
  taskLabel: string;
  status: TokenStatus;
  focus?: string;
  shareLevel?: ShareLevel;
};

export type HeartbeatBody = {
  eventId: string;
  botId: string;
};

export type EventCreateBody = {
  name: string;
  date: string;
};

export type SquadInviteBody = {
  eventId: string;
  attendeeId: string;
  squadId?: string;
};

export type SquadRequestBody = {
  eventId: string;
  squadId: string;
};

export type SquadLeaveBody = {
  eventId: string;
  squadId?: string;
};

export type ExchangeProposeBody = {
  eventId: string;
  fromBotId: string;
  toBotId?: string;
  toSquadId?: string;
  taskLabel?: string;
  status?: TokenStatus;
  focus?: string;
  shareLevel?: ShareLevel;
};

export type ExchangeResolveBody = {
  eventId: string;
  requestId: string;
};

export type PrefsBody = {
  eventId: string;
  shareLevel?: ShareLevel;
  shareTokens?: boolean;
  permissionsAccepted?: boolean;
  hasGrokBot?: boolean;
};

export function parseClaimBody(value: unknown): ClaimBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventCode = asString(value.eventCode);
  const name = asString(value.name);
  const colorRaw = asString(value.botColor);
  const botColor = colorRaw ? parseBotColor(colorRaw) : null;
  const shareLevelRaw = asString(value.shareLevel) ?? "label+status";
  const hasGrokBot = asBoolean(value.hasGrokBot) ?? true;
  const acceptPermissions = asBoolean(value.acceptPermissions) ?? true;
  if (!eventCode || !name || !botColor || !isShareLevel(shareLevelRaw)) {
    return null;
  }
  return {
    eventCode,
    name,
    botColor,
    shareLevel: shareLevelRaw,
    hasGrokBot,
    acceptPermissions,
    lumaHandle: asString(value.lumaHandle) ?? undefined,
    lumaProfileUrl: asString(value.lumaProfileUrl) ?? undefined,
    githubHandle: asString(value.githubHandle) ?? undefined,
    originUsername: asString(value.originUsername) ?? undefined,
  };
}

export function parseProfileBody(value: unknown): ProfileBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  if (!eventId) {
    return null;
  }
  return {
    eventId,
    lumaHandle: asString(value.lumaHandle) ?? undefined,
    lumaProfileUrl: asString(value.lumaProfileUrl) ?? undefined,
    githubHandle: asString(value.githubHandle) ?? undefined,
    originUsername: asString(value.originUsername) ?? undefined,
  };
}

export function parseSyncBody(value: unknown): SyncBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const botId = asString(value.botId);
  const taskLabel = asString(value.taskLabel);
  const statusRaw = asString(value.status);
  const focus = asString(value.focus) ?? undefined;
  const shareRaw = asString(value.shareLevel);
  if (!eventId || !botId || !taskLabel || !statusRaw || !isTokenStatus(statusRaw)) {
    return null;
  }
  if (taskLabel.length > TASK_LABEL_MAX) {
    return null;
  }
  if (shareRaw && !isShareLevel(shareRaw)) {
    return null;
  }
  return {
    eventId,
    botId,
    taskLabel,
    status: statusRaw,
    focus,
    shareLevel: shareRaw && isShareLevel(shareRaw) ? shareRaw : undefined,
  };
}

export function parseHeartbeatBody(value: unknown): HeartbeatBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const botId = asString(value.botId);
  if (!eventId || !botId) {
    return null;
  }
  return { eventId, botId };
}

export function parseEventCreateBody(value: unknown): EventCreateBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = asString(value.name);
  const date = asString(value.date);
  if (!name || !date) {
    return null;
  }
  return { name, date };
}

export function parseSquadInviteBody(value: unknown): SquadInviteBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const attendeeId = asString(value.attendeeId);
  const squadId = asString(value.squadId) ?? undefined;
  if (!eventId || !attendeeId) {
    return null;
  }
  return { eventId, attendeeId, squadId };
}

export function parseSquadRequestBody(value: unknown): SquadRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const squadId = asString(value.squadId);
  if (!eventId || !squadId) {
    return null;
  }
  return { eventId, squadId };
}

export function parseSquadLeaveBody(value: unknown): SquadLeaveBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  if (!eventId) {
    return null;
  }
  return { eventId, squadId: asString(value.squadId) ?? undefined };
}

export function parseExchangeProposeBody(value: unknown): ExchangeProposeBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const fromBotId = asString(value.fromBotId);
  const toBotId = asString(value.toBotId) ?? undefined;
  const toSquadId = asString(value.toSquadId) ?? undefined;
  if (!eventId || !fromBotId || (!toBotId && !toSquadId)) {
    return null;
  }
  const statusRaw = asString(value.status);
  if (statusRaw && !isTokenStatus(statusRaw)) {
    return null;
  }
  const shareRaw = asString(value.shareLevel);
  if (shareRaw && !isShareLevel(shareRaw)) {
    return null;
  }
  return {
    eventId,
    fromBotId,
    toBotId,
    toSquadId,
    taskLabel: asString(value.taskLabel) ?? undefined,
    status: statusRaw && isTokenStatus(statusRaw) ? statusRaw : undefined,
    focus: asString(value.focus) ?? undefined,
    shareLevel: shareRaw && isShareLevel(shareRaw) ? shareRaw : undefined,
  };
}

export function parseExchangeResolveBody(value: unknown): ExchangeResolveBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  const requestId = asString(value.requestId);
  if (!eventId || !requestId) {
    return null;
  }
  return { eventId, requestId };
}

export function parsePrefsBody(value: unknown): PrefsBody | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventId = asString(value.eventId);
  if (!eventId) {
    return null;
  }
  const shareRaw = asString(value.shareLevel);
  if (shareRaw && !isShareLevel(shareRaw)) {
    return null;
  }
  return {
    eventId,
    shareLevel: shareRaw && isShareLevel(shareRaw) ? shareRaw : undefined,
    shareTokens: asBoolean(value.shareTokens) ?? undefined,
    permissionsAccepted: asBoolean(value.permissionsAccepted) ?? undefined,
    hasGrokBot: asBoolean(value.hasGrokBot) ?? undefined,
  };
}
