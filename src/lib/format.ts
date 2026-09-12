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

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

/** Server-side public lobby origin (tunnel / Pages). Prefer LOBBY_PUBLIC_URL when host browses localhost. */
export function configuredPublicOrigin(): string | null {
  const value = process.env.LOBBY_PUBLIC_URL;
  return value ? normalizeOrigin(value) : null;
}

/** Browser-side public lobby origin for join command snippets. */
export function clientLobbyOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_LOBBY_PUBLIC_URL;
  if (configured) {
    return normalizeOrigin(configured);
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://127.0.0.1:4521";
}

function isLoopbackHost(host: string): boolean {
  const bare = host.split(",")[0]!.trim().split(":")[0]!.toLowerCase();
  return bare === "localhost" || bare === "127.0.0.1" || bare === "[::1]";
}

export function originFromRequest(request: Request): string {
  const configured = configuredPublicOrigin();
  if (configured) {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]!.trim();
    if (!isLoopbackHost(host)) {
      return `${forwardedProto}://${host}`;
    }
  }

  const host = request.headers.get("host");
  if (host && !isLoopbackHost(host)) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (new URL(request.url).protocol === "https:" ? "https" : "http");
    return `${proto}://${host.split(",")[0]!.trim()}`;
  }

  return new URL(request.url).origin;
}
