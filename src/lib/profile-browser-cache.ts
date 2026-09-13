import type { LumaProfile } from "@/lib/domain";

export const LUMA_BROWSER_CACHE_KEY = "gbl_luma_profiles_v1";
export const LUMA_BROWSER_CACHE_TTL_MS = 15 * 60 * 1000;

export type CachedLumaEntry = {
  profile: LumaProfile;
  fetchedAt: number;
};

export type LumaBrowserCache = Record<string, CachedLumaEntry>;

export function isFreshCacheEntry(entry: CachedLumaEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < LUMA_BROWSER_CACHE_TTL_MS;
}

export function parseLumaBrowserCache(raw: string | null, now = Date.now()): LumaProfile[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return [];
    }
    return Object.values(parsed as LumaBrowserCache)
      .filter((entry) => entry && isFreshCacheEntry(entry, now) && entry.profile?.userId)
      .map((entry) => entry.profile);
  } catch {
    return [];
  }
}

export function mergeLumaProfiles(primary: LumaProfile[], cached: LumaProfile[]): LumaProfile[] {
  const byId = new Map<string, LumaProfile>();
  for (const profile of cached) {
    byId.set(profile.userId, profile);
  }
  for (const profile of primary) {
    byId.set(profile.userId, profile);
  }
  return [...byId.values()];
}

export function writeLumaBrowserCache(profiles: LumaProfile[], now = Date.now()): string {
  const cache: LumaBrowserCache = {};
  for (const profile of profiles) {
    cache[profile.userId] = { profile, fetchedAt: now };
  }
  return JSON.stringify(cache);
}

export function readLumaProfilesFromStorage(): LumaProfile[] {
  if (typeof window === "undefined") {
    return [];
  }
  return parseLumaBrowserCache(window.localStorage.getItem(LUMA_BROWSER_CACHE_KEY));
}

export function persistLumaProfilesToStorage(profiles: LumaProfile[]): void {
  if (typeof window === "undefined") {
    return;
  }
  const existing = parseLumaBrowserCache(window.localStorage.getItem(LUMA_BROWSER_CACHE_KEY));
  const merged = mergeLumaProfiles(profiles, existing);
  window.localStorage.setItem(LUMA_BROWSER_CACHE_KEY, writeLumaBrowserCache(merged));
}
