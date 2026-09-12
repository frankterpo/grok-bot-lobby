import { HOST_USER_ID } from "@/lib/domain";
import { HOST_SECRET_HEADER, HOST_SESSION_COOKIE } from "@/lib/identity";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type HostSessionPayload = {
  role: "host";
  userId: string;
  exp: number;
  iat: number;
};

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function b64urlEncode(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function resolveHostSecret(): string | null {
  const configured = process.env.HOST_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "development") {
    return "gbl-dev-host-secret-change-me";
  }
  return null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function verifyHostSecret(provided: string | null): boolean {
  const secret = resolveHostSecret();
  if (!secret || !provided) {
    return false;
  }
  return timingSafeEqual(provided, secret);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    const sigBytes = new Uint8Array(b64urlDecode(signature));
    return await crypto.subtle.verify("HMAC", key, sigBytes, textEncoder().encode(data));
  } catch {
    return false;
  }
}

export async function createHostSessionToken(userId: string = HOST_USER_ID): Promise<string | null> {
  const secret = resolveHostSecret();
  if (!secret) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: HostSessionPayload = {
    role: "host",
    userId,
    iat: now,
    exp: now + SESSION_MAX_AGE_SEC,
  };
  const payloadPart = b64urlEncode(textEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(payloadPart, secret);
  return `${payloadPart}.${sig}`;
}

export async function parseHostSessionToken(token: string | null | undefined): Promise<HostSessionPayload | null> {
  if (!token) {
    return null;
  }
  const secret = resolveHostSecret();
  if (!secret) {
    return null;
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  if (!(await hmacVerify(payloadPart, sigPart, secret))) {
    return null;
  }
  try {
    const json = new TextDecoder().decode(b64urlDecode(payloadPart));
    const payload = JSON.parse(json) as HostSessionPayload;
    if (payload.role !== "host" || typeof payload.userId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cookieSuffix(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; SameSite=Lax; HttpOnly${secure}`;
}

export function hostSessionCookie(token: string): string {
  return `${HOST_SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SEC}; ${cookieSuffix()}`;
}

export function clearHostSessionCookie(): string {
  return `${HOST_SESSION_COOKIE}=; Max-Age=0; ${cookieSuffix()}`;
}

export async function hostSessionFromRequest(request: Request): Promise<HostSessionPayload | null> {
  const headerToken = request.headers.get(HOST_SECRET_HEADER);
  if (headerToken && verifyHostSecret(headerToken)) {
    return { role: "host", userId: HOST_USER_ID, iat: 0, exp: Number.MAX_SAFE_INTEGER };
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${HOST_SESSION_COOKIE}=([^;]+)`));
  return parseHostSessionToken(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export async function isHostAuthenticated(request: Request): Promise<boolean> {
  return (await hostSessionFromRequest(request)) !== null;
}
