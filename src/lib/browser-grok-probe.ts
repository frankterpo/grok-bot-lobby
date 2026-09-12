/** Experimental probes for what a browser tab can reach toward Grok Bot. */

export type LocalFolderProbe = {
  folderName: string;
  files: string[];
  hasGrokbotScript: boolean;
  hasGatewayJson: boolean;
  gatewayPreview: string | null;
  readError: string | null;
};

export type LocalhostGatewayProbe = {
  url: string;
  ok: boolean;
  status: number | null;
  cors: "allowed" | "blocked" | "unknown";
  detail: string;
};

const GATEWAY_PORTS = [1340, 4521] as const;

async function listTopLevelFiles(handle: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of handle.values()) {
    names.push(entry.name);
  }
  return names.sort();
}

async function readTextFile(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<string | null> {
  let current: FileSystemDirectoryHandle = dir;
  for (let index = 0; index < path.length - 1; index += 1) {
    current = await current.getDirectoryHandle(path[index]!);
  }
  const fileHandle = await current.getFileHandle(path[path.length - 1]!);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function probeLocalSkillFolder(
  handle: FileSystemDirectoryHandle,
): Promise<LocalFolderProbe> {
  const files = await listTopLevelFiles(handle);
  let hasGrokbotScript = false;
  let hasGatewayJson = false;
  let gatewayPreview: string | null = null;
  let readError: string | null = null;

  try {
    await handle.getFileHandle("scripts/grokbot.py");
    hasGrokbotScript = true;
  } catch {
    // not a grok-bot skill root
  }

  try {
    const raw = await readTextFile(handle, ["gateway.json"]);
    hasGatewayJson = true;
    gatewayPreview = raw?.slice(0, 120) ?? null;
  } catch {
    try {
      const raw = await readTextFile(handle, ["sand-data", "gateway.json"]);
      hasGatewayJson = true;
      gatewayPreview = raw?.slice(0, 120) ?? null;
    } catch {
      // gateway.json not in picked folder
    }
  }

  if (!hasGrokbotScript && !hasGatewayJson) {
    readError =
      "No scripts/grokbot.py or gateway.json in this folder. sand-data lives on the Grok Bot Agent Computer, not in the skill install.";
  }

  return {
    folderName: handle.name,
    files: files.slice(0, 12),
    hasGrokbotScript,
    hasGatewayJson,
    gatewayPreview,
    readError,
  };
}

export async function probeLocalhostGateway(port: number): Promise<LocalhostGatewayProbe> {
  const url = `http://127.0.0.1:${port}/health`;
  try {
    const response = await fetch(url, { mode: "cors", cache: "no-store" });
    return {
      url,
      ok: response.ok,
      status: response.status,
      cors: "allowed",
      detail: response.ok ? "Gateway responded (still needs token for API calls)." : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    const corsBlocked =
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("CORS");
    return {
      url,
      ok: false,
      status: null,
      cors: corsBlocked ? "blocked" : "unknown",
      detail: corsBlocked
        ? "Cross-origin blocked or gateway not listening. Browsers cannot read localhost gateway from a remote lobby origin."
        : message,
    };
  }
}

export async function probeDefaultGateways(): Promise<LocalhostGatewayProbe[]> {
  return Promise.all(GATEWAY_PORTS.map((port) => probeLocalhostGateway(port)));
}

export function fsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickSkillFolder(): Promise<FileSystemDirectoryHandle> {
  if (!fsAccessSupported()) {
    throw new Error("File System Access API is not available in this browser.");
  }
  return window.showDirectoryPicker({ mode: "read" });
}
