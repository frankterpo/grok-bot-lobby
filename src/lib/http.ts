import { LobbyError } from "@/lib/lobby-store";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T): Response {
  return Response.json(data, { status: 201 });
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function handleError(error: unknown): Response {
  if (error instanceof LobbyError) {
    return jsonError(error.message, error.status);
  }
  return jsonError("Something broke in the lobby.", 500);
}
