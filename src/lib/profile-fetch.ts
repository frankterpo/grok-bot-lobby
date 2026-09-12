import type { BotProfile } from "@/lib/domain";

export type ProfileInput = {
  lumaHandle?: string;
  lumaProfileUrl?: string;
  githubHandle?: string;
  originUsername?: string;
};

type GitHubUser = {
  login?: string;
  name?: string;
  bio?: string | null;
  avatar_url?: string;
  twitter_username?: string | null;
};

function normalizeHandle(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^@/, "");
  return trimmed || undefined;
}

function lumaHandleFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "u" && parts[1]) {
      return parts[1];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function fetchGitHub(handle: string): Promise<Partial<BotProfile>> {
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "grok-bot-lobby" },
  });
  if (!response.ok) {
    return { githubHandle: handle };
  }
  const user = (await response.json()) as GitHubUser;
  return {
    githubHandle: user.login ?? handle,
    bio: user.bio ?? undefined,
    avatarUrl: user.avatar_url,
    twitter: user.twitter_username ?? undefined,
  };
}

/** Fetch and merge public profile fields (best-effort; caches caller-side). */
export async function fetchPublicProfile(
  userId: string,
  input: ProfileInput,
  existing?: BotProfile | null,
): Promise<BotProfile> {
  const lumaHandle = normalizeHandle(input.lumaHandle) ?? lumaHandleFromUrl(input.lumaProfileUrl ?? "");
  const githubHandle = normalizeHandle(input.githubHandle);
  const originUsername = normalizeHandle(input.originUsername);
  const lumaProfileUrl = input.lumaProfileUrl?.trim() || undefined;

  const base: BotProfile = {
    userId,
    bio: existing?.bio,
    twitter: existing?.twitter,
    linkedin: existing?.linkedin,
    lumaHandle: lumaHandle ?? existing?.lumaHandle,
    lumaProfileUrl: lumaProfileUrl ?? existing?.lumaProfileUrl,
    githubHandle: githubHandle ?? existing?.githubHandle,
    originUsername: originUsername ?? existing?.originUsername,
    avatarUrl: existing?.avatarUrl,
    pastEvents: existing?.pastEvents ?? [],
    fetchedAt: new Date().toISOString(),
  };

  if (githubHandle) {
    try {
      const gh = await fetchGitHub(githubHandle);
      Object.assign(base, {
        githubHandle: gh.githubHandle ?? githubHandle,
        bio: gh.bio ?? base.bio,
        avatarUrl: gh.avatarUrl ?? base.avatarUrl,
        twitter: gh.twitter ?? base.twitter,
      });
    } catch {
      base.githubHandle = githubHandle;
    }
  }

  if (originUsername && !base.bio) {
    base.bio = `Origin: @${originUsername}`;
  }

  if (lumaHandle && !base.bio) {
    base.bio = `Luma: @${lumaHandle}`;
  }

  return base;
}
