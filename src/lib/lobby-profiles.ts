import type { Attendee, LumaProfile } from "@/lib/domain";
import { invalidateProfileCache, resolvePublicProfile, type ProfileInputs } from "@/lib/profile-fetch";
import type { StoredEvent } from "@/lib/seed";

export type ProfileUpdateInput = ProfileInputs & {
  eventId: string;
  botId: string;
};

export async function applyProfileInputs(
  event: StoredEvent,
  botId: string,
  inputs: ProfileInputs,
  profiles: Map<string, LumaProfile>,
): Promise<void> {
  const attendee = event.attendees.find((person) => person.id === botId);
  if (!attendee) {
    return;
  }
  if (inputs.lumaProfileUrl) {
    attendee.lumaProfileUrl = inputs.lumaProfileUrl.trim();
  }
  if (inputs.lumaHandle) {
    attendee.lumaHandle = inputs.lumaHandle.trim();
  }
  if (inputs.githubProfileUrl) {
    attendee.githubProfileUrl = inputs.githubProfileUrl.trim();
  }
  if (inputs.githubHandle) {
    attendee.githubHandle = inputs.githubHandle.trim();
  }
  if (inputs.originProfileUrl) {
    attendee.originProfileUrl = inputs.originProfileUrl.trim();
  }
  if (inputs.originHandle) {
    attendee.originHandle = inputs.originHandle.trim();
  }
  invalidateProfileCache(botId);
  const profile = await resolvePublicProfile(botId, {
    lumaProfileUrl: attendee.lumaProfileUrl,
    lumaHandle: attendee.lumaHandle,
    githubProfileUrl: attendee.githubProfileUrl,
    githubHandle: attendee.githubHandle,
    originProfileUrl: attendee.originProfileUrl,
    originHandle: attendee.originHandle,
  });
  profiles.set(botId, profile);
}

export function profileInputsFromAttendee(attendee: Attendee): ProfileInputs {
  return {
    lumaProfileUrl: attendee.lumaProfileUrl,
    lumaHandle: attendee.lumaHandle,
    githubProfileUrl: attendee.githubProfileUrl,
    githubHandle: attendee.githubHandle,
    originProfileUrl: attendee.originProfileUrl,
    originHandle: attendee.originHandle,
  };
}
