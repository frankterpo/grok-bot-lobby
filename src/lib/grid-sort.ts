import type { Attendee, PresenceView } from "@/lib/domain";

export function soloAttendeeRank(
  id: string,
  sessionUserId: string | null,
  presence: PresenceView[],
  hostUserId: string,
): number {
  if (sessionUserId && id === sessionUserId) {
    return 0;
  }
  const record = presence.find((item) => item.userId === id);
  if (record?.state === "active") {
    return 1;
  }
  if (id === hostUserId) {
    return 2;
  }
  if (!id.startsWith("demo_")) {
    return 3;
  }
  return 4;
}

export function sortSoloAttendees(
  attendees: Attendee[],
  sessionUserId: string | null,
  presence: PresenceView[],
  hostUserId: string,
): Attendee[] {
  return [...attendees].sort((a, b) => {
    const delta =
      soloAttendeeRank(a.id, sessionUserId, presence, hostUserId) -
      soloAttendeeRank(b.id, sessionUserId, presence, hostUserId);
    if (delta !== 0) {
      return delta;
    }
    return a.name.localeCompare(b.name);
  });
}

export function filterSoloAttendees(
  attendees: Attendee[],
  presence: PresenceView[],
  hostUserId: string,
): Attendee[] {
  return attendees.filter(
    (attendee) =>
      !attendee.squadId &&
      (attendee.id === hostUserId ||
        !attendee.id.startsWith("demo_") ||
        presence.find((item) => item.userId === attendee.id)?.claimed),
  );
}
