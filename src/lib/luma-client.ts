import type { LumaPastEvent, LumaProfile } from "@/lib/domain";

export function lumaApiSecret(): string | null {
  const secret = process.env.LUMA_API_SECRET?.trim();
  return secret ? secret : null;
}

type LumaUserPayload = {
  name?: string;
  bio?: string;
  twitter_handle?: string;
  linkedin_handle?: string;
  username?: string;
  past_events?: Array<{ api_id?: string; name?: string; start_at?: string; geo_address_json?: { city?: string } }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePastEvents(value: unknown): LumaPastEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index): LumaPastEvent | null => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const name = typeof record.name === "string" ? record.name : null;
      if (!name) {
        return null;
      }
      const geo = asRecord(record.geo_address_json);
      return {
        id: typeof record.api_id === "string" ? record.api_id : `luma_${index}`,
        name,
        date: typeof record.start_at === "string" ? record.start_at : new Date().toISOString(),
        city: typeof geo?.city === "string" ? geo.city : undefined,
      };
    })
    .filter((item): item is LumaPastEvent => item !== null);
}

export async function fetchLumaUser(handle: string): Promise<Partial<LumaProfile> | null> {
  const secret = lumaApiSecret();
  if (!secret || !handle.trim()) {
    return null;
  }
  const username = handle.replace(/^@/, "").trim();
  try {
    const response = await fetch(
      `https://public-api.lu.ma/v1/user/get?username=${encodeURIComponent(username)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
          "User-Agent": "grok-bot-lobby",
        },
      },
    );
    if (!response.ok) {
      return null;
    }
    const json: unknown = await response.json();
    const root = asRecord(json);
    const user = (asRecord(root?.user) ?? root) as LumaUserPayload | null;
    if (!user) {
      return null;
    }
    return {
      lumaHandle: username,
      bio: typeof user.bio === "string" && user.bio.trim() ? user.bio.trim() : undefined,
      twitter: typeof user.twitter_handle === "string" ? user.twitter_handle : undefined,
      linkedin: typeof user.linkedin_handle === "string" ? user.linkedin_handle : undefined,
      pastEvents: parsePastEvents(user.past_events),
    };
  } catch {
    return null;
  }
}
