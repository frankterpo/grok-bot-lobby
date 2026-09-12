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
