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

export function originFromRequest(request: Request): string {
  return new URL(request.url).origin;
}
