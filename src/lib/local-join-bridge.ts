/** Client helpers for the loopback grok-lobby-bridge sidecar (Phase 2). */

export const SIDECAR_BASE = "http://127.0.0.1:9139";

export type SidecarJoinRequest = {
  code: string;
  url: string;
  name: string;
  task?: string;
  color?: string;
  shareLevel?: string;
  lumaHandle?: string;
  lumaProfileUrl?: string;
};

export type SidecarJoinResponse = {
  ok: boolean;
  userId?: string;
  eventId?: string;
  error?: string;
  pid?: number;
};

export type SidecarHealth = {
  ok: boolean;
  version?: string;
  /** Why probe failed — helps UI explain "always waiting". */
  reason?: "ready" | "not_running" | "blocked" | "error";
  detail?: string;
};

export async function probeSidecar(): Promise<SidecarHealth> {
  try {
    const response = await fetch(`${SIDECAR_BASE}/health`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, reason: "error", detail: `HTTP ${response.status}` };
    }
    const json = (await response.json()) as SidecarHealth;
    return { ok: json.ok === true, version: json.version, reason: json.ok ? "ready" : "error" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    const blocked =
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("CORS") ||
      message.includes("Load failed");
    return {
      ok: false,
      reason: blocked ? "blocked" : "not_running",
      detail: message,
    };
  }
}

export async function postSidecarJoin(body: SidecarJoinRequest): Promise<SidecarJoinResponse> {
  try {
    const response = await fetch(`${SIDECAR_BASE}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as SidecarJoinResponse;
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : "sidecar unreachable";
    return { ok: false, error: message };
  }
}
