import { promises as fs } from "node:fs";
import path from "node:path";

import { isLoopbackHost } from "@/lib/format";
import { LobbyError } from "@/lib/lobby-store";

const ENV_KEYS = ["LOBBY_PUBLIC_URL", "NEXT_PUBLIC_LOBBY_PUBLIC_URL"] as const;

const HOSTNAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export type ParsedPublicHostname = {
  hostname: string;
  zone: string;
  publicUrl: string;
};

export function normalizePublicHostnameInput(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? host;
  host = host.split(":")[0] ?? host;
  host = host.replace(/\.$/, "");

  if (!host) {
    return host;
  }

  const labels = host.split(".").filter(Boolean);
  if (labels.length === 2) {
    return `lobby.${host}`;
  }

  return host;
}

export function zoneFromHostname(hostname: string): string {
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname;
  }
  return labels.slice(-2).join(".");
}

export function validatePublicHostname(input: string): ParsedPublicHostname {
  const hostname = normalizePublicHostnameInput(input);
  if (!hostname) {
    throw new LobbyError("Enter a public hostname or Cloudflare zone.", 400);
  }

  if (isLoopbackHost(hostname)) {
    throw new LobbyError("Public hostname cannot be localhost.", 400);
  }

  if (!HOSTNAME_PATTERN.test(hostname)) {
    throw new LobbyError("Enter a valid hostname (e.g. lobby.example.com or example.com).", 400);
  }

  const publicUrl = `https://${hostname}`;
  return {
    hostname,
    zone: zoneFromHostname(hostname),
    publicUrl,
  };
}

export function buildPublicUrlEnvBlock(publicUrl: string): string {
  return ENV_KEYS.map((key) => `${key}=${publicUrl}`).join("\n");
}

export function mergeEnvLocalContent(existing: string, publicUrl: string): string {
  const keyValues: Record<(typeof ENV_KEYS)[number], string> = {
    LOBBY_PUBLIC_URL: publicUrl,
    NEXT_PUBLIC_LOBBY_PUBLIC_URL: publicUrl,
  };

  const lines = existing.length > 0 ? existing.split("\n") : [];
  const updatedKeys = new Set<string>();

  const merged = lines.map((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) {
      return line;
    }
    const key = match[1]!;
    if (!(key in keyValues)) {
      return line;
    }
    updatedKeys.add(key);
    return `${key}=${keyValues[key as (typeof ENV_KEYS)[number]]}`;
  });

  const missing = ENV_KEYS.filter((key) => !updatedKeys.has(key));
  if (missing.length > 0) {
    if (merged.length > 0 && merged[merged.length - 1] !== "") {
      merged.push("");
    }
    for (const key of missing) {
      merged.push(`${key}=${keyValues[key]}`);
    }
  }

  const text = merged.join("\n");
  if (existing.endsWith("\n") || existing.length === 0) {
    return `${text}\n`;
  }
  return text;
}

export function envLocalPath(): string {
  return path.join(process.cwd(), ".env.local");
}

export function assertDevLocalRequest(request: Request): void {
  if (process.env.NODE_ENV !== "development") {
    throw new LobbyError("Public URL configuration is only available in development.", 403);
  }

  const hostHeader = request.headers.get("host") ?? "";
  const host = hostHeader.split(",")[0]!.trim();
  if (!isLoopbackHost(host)) {
    throw new LobbyError("Public URL configuration is limited to localhost requests.", 403);
  }
}

export async function writePublicUrlToEnvLocal(publicUrl: string): Promise<{ path: string; created: boolean }> {
  const filePath = envLocalPath();
  let existing = "";
  let created = false;

  try {
    existing = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    created = true;
  }

  const merged = mergeEnvLocalContent(existing, publicUrl);
  await fs.writeFile(filePath, merged, "utf8");
  return { path: filePath, created };
}

export function tunnelSetupCommand(hostname: string, zone: string): string {
  return `npm run tunnel:setup -- --hostname ${hostname} --zone ${zone}`;
}
