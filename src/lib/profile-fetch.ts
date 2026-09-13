import type { LumaProfile } from "@/lib/domain";
import { fetchLumaUser } from "@/lib/luma-client";

export type ProfileInputs = {
  lumaProfileUrl?: string;
  lumaHandle?: string;
  githubProfileUrl?: string;
  githubHandle?: string;
  originProfileUrl?: string;
  originHandle?: string;
};

type CacheEntry = {
  profile: LumaProfile;
  fetchedAt: number;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string): string {
  return userId;
}

function parseGithubHandle(urlOrHandle: string): string | null {
  const trimmed = urlOrHandle.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes("/")) {
    return trimmed.replace(/^@/, "");
  }
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "users" && parts[1]) {
      return parts[1];
    }
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

function parseOriginHandle(urlOrHandle: string): string | null {
  const trimmed = urlOrHandle.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes("/")) {
    return trimmed.replace(/^@/, "");
  }
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function parseLumaHandle(urlOrHandle: string): string | null {
  const trimmed = urlOrHandle.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes("/")) {
    return trimmed.replace(/^@/, "");
  }
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const userIdx = parts.indexOf("user");
    if (userIdx >= 0 && parts[userIdx + 1]) {
      return parts[userIdx + 1];
    }
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

async function fetchGithubBio(handle: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "grok-bot-lobby" },
    });
    if (!response.ok) {
      return undefined;
    }
    const json = (await response.json()) as { bio?: string | null; name?: string | null };
    return json.bio?.trim() || json.name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function resolvePublicProfile(
  userId: string,
  inputs: ProfileInputs,
): Promise<LumaProfile> {
  const key = cacheKey(userId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.profile;
  }

  const lumaHandle = inputs.lumaHandle ?? parseLumaHandle(inputs.lumaProfileUrl ?? "") ?? undefined;
  const githubHandle = inputs.githubHandle ?? parseGithubHandle(inputs.githubProfileUrl ?? "") ?? undefined;
  const originHandle = inputs.originHandle ?? parseOriginHandle(inputs.originProfileUrl ?? "") ?? undefined;

  const githubBio = githubHandle ? await fetchGithubBio(githubHandle) : undefined;
  const luma = lumaHandle ? await fetchLumaUser(lumaHandle) : null;
  const bioParts = [
    luma?.bio,
    lumaHandle && !luma?.bio ? `Luma @${lumaHandle}` : null,
    githubHandle ? `GitHub @${githubHandle}` : null,
    originHandle ? `Origin @${originHandle}` : null,
    githubBio,
  ].filter(Boolean);

  const profile: LumaProfile = {
    userId,
    bio: bioParts.length > 0 ? bioParts.join(" · ") : undefined,
    twitter: luma?.twitter,
    linkedin: luma?.linkedin,
    pastEvents: luma?.pastEvents ?? [],
    githubHandle,
    originHandle,
    githubBio,
    lumaHandle,
  };

  cache.set(key, { profile, fetchedAt: Date.now() });
  return profile;
}

export function invalidateProfileCache(userId: string): void {
  cache.delete(cacheKey(userId));
}
