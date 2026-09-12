import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

function tunnelDevOrigins(): string[] {
  const origins = new Set<string>(["127.0.0.1", "*.trycloudflare.com"]);

  for (const key of ["LOBBY_PUBLIC_URL", "NEXT_PUBLIC_LOBBY_PUBLIC_URL"] as const) {
    const value = process.env[key];
    if (!value) {
      continue;
    }
    try {
      const host = new URL(value).hostname;
      origins.add(host);
      const parts = host.split(".");
      if (parts.length > 2) {
        origins.add(`*.${parts.slice(-2).join(".")}`);
      }
    } catch {
      // ignore invalid URL
    }
  }

  const explicit = process.env.LOBBY_TUNNEL_HOSTNAME;
  if (explicit) {
    origins.add(explicit);
  }

  return [...origins];
}

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: tunnelDevOrigins(),
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
