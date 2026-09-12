/** Client helpers for the loopback grok-lobby-bridge sidecar (Phase 2). */

export const SIDECAR_BASE = "http://127.0.0.1:9139";

export type SidecarJoinRequest = {
  code: string;
  url: string;
  name: string;
  task?: string;
  color?: string;
  shareLevel?: string;
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
};

export async function probeSidecar(): Promise<SidecarHealth> {
  try {
    const response = await fetch(`${SIDECAR_BASE}/health`, { method: "GET" });
    if (!response.ok) {
      return { ok: false };
    }
    const json = (await response.json()) as SidecarHealth;
    return { ok: json.ok === true, version: json.version };
  } catch {
    return { ok: false };
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
