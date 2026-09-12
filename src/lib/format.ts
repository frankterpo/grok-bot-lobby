export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function joinPath(code: string): string {
  return `/join/${encodeURIComponent(code.toUpperCase())}`;
}

export function joinUrl(origin: string, code: string): string {
  return `${origin}${joinPath(code)}`;
}

export const PLACEHOLDER_LOBBY_PUBLIC_URL = "https://lobby.example.com";
export const PERSISTENT_TUNNEL_DOC_PATH = "docs/persistent-tunnel.md";

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

function readConfiguredPublicUrl(): string | null {
  for (const key of ["LOBBY_PUBLIC_URL", "NEXT_PUBLIC_LOBBY_PUBLIC_URL"] as const) {
    const value = process.env[key];
    if (!value) {
      continue;
    }
    const normalized = normalizeOrigin(value);
    if (normalized === PLACEHOLDER_LOBBY_PUBLIC_URL) {
      continue;
    }
    return normalized;
  }
  return null;
}

export function isLoopbackHost(host: string): boolean {
  const bare = host.split(",")[0]!.trim().split(":")[0]!.toLowerCase();
  return bare === "localhost" || bare === "127.0.0.1" || bare === "[::1]";
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    return isLoopbackHost(new URL(origin).host);
  } catch {
    return true;
  }
}

export type LobbyBaseUrlSource = "env" | "request" | "browser" | "fallback";

export type LobbyBaseUrl = {
  baseUrl: string;
  isRemoteShareable: boolean;
  source: LobbyBaseUrlSource;
};

/** Prefer LOBBY_PUBLIC_URL / NEXT_PUBLIC_LOBBY_PUBLIC_URL; else non-loopback request/browser origin. */
export function getLobbyBaseUrl(options?: { request?: Request }): LobbyBaseUrl {
  const configured = readConfiguredPublicUrl();
  if (configured) {
    return { baseUrl: configured, isRemoteShareable: true, source: "env" };
  }

  const request = options?.request;
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    if (forwardedHost) {
      const host = forwardedHost.split(",")[0]!.trim();
      if (!isLoopbackHost(host)) {
        return {
          baseUrl: `${forwardedProto}://${host}`,
          isRemoteShareable: true,
          source: "request",
        };
      }
    }

    const host = request.headers.get("host");
    if (host && !isLoopbackHost(host)) {
      const proto =
        request.headers.get("x-forwarded-proto") ??
        (new URL(request.url).protocol === "https:" ? "https" : "http");
      return {
        baseUrl: `${proto}://${host.split(",")[0]!.trim()}`,
        isRemoteShareable: true,
        source: "request",
      };
    }

    const origin = new URL(request.url).origin;
    return {
      baseUrl: origin,
      isRemoteShareable: !isLoopbackOrigin(origin),
      source: "fallback",
    };
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    return {
      baseUrl: origin,
      isRemoteShareable: !isLoopbackOrigin(origin),
      source: "browser",
    };
  }

  return {
    baseUrl: "http://127.0.0.1:4521",
    isRemoteShareable: false,
    source: "fallback",
  };
}

export function extractJoinCodeFromUrl(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/^\/join\/([^/]+)$/i);
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    return null;
  }
}

export type ResolvedShareJoinUrl = {
  url: string;
  isRemoteShareable: boolean;
};

/** Rewrite localhost join URLs to the configured public base when available. */
export function resolveShareJoinUrl(joinUrlInput: string): ResolvedShareJoinUrl {
  const code = extractJoinCodeFromUrl(joinUrlInput);
  const { baseUrl, isRemoteShareable } = getLobbyBaseUrl();

  if (code && isRemoteShareable) {
    return { url: joinUrl(baseUrl, code), isRemoteShareable: true };
  }

  try {
    const parsed = new URL(joinUrlInput);
    if (!isLoopbackOrigin(parsed.origin)) {
      return { url: joinUrlInput, isRemoteShareable: true };
    }
  } catch {
    // ignore invalid URL
  }

  if (code) {
    return { url: joinUrl(baseUrl, code), isRemoteShareable: false };
  }

  return { url: joinUrlInput, isRemoteShareable: false };
}

/** @deprecated Use readConfiguredPublicUrl via getLobbyBaseUrl */
export function configuredPublicOrigin(): string | null {
  return readConfiguredPublicUrl();
}

/** Browser-side public lobby origin for join command snippets. */
export function clientLobbyOrigin(): string {
  return getLobbyBaseUrl().baseUrl;
}

export function originFromRequest(request: Request): string {
  return getLobbyBaseUrl({ request }).baseUrl;
}
