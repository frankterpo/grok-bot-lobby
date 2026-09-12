import {
  assertDevLocalRequest,
  validatePublicHostname,
  writePublicUrlToEnvLocal,
} from "@/lib/env-local";
import { handleError, isRecord, jsonOk, readJson } from "@/lib/http";
import { LobbyError } from "@/lib/lobby-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigurePublicUrlResponse = {
  ok: true;
  publicUrl: string;
  hostname: string;
  zone: string;
  message: string;
  envLocalPath: string;
  created: boolean;
};

export async function POST(request: Request): Promise<Response> {
  try {
    assertDevLocalRequest(request);

    const body = await readJson(request);
    if (!isRecord(body)) {
      throw new LobbyError("Request body must be JSON.", 400);
    }

    const hostnameInput = body.hostname;
    if (typeof hostnameInput !== "string" || !hostnameInput.trim()) {
      throw new LobbyError("hostname is required.", 400);
    }

    const parsed = validatePublicHostname(hostnameInput);
    const { path: envLocalPath, created } = await writePublicUrlToEnvLocal(parsed.publicUrl);

    const message = created
      ? `Created ${envLocalPath} with your public URL. Restart npm run dev for Next.js to load the new env vars.`
      : `Updated ${envLocalPath}. Restart npm run dev for Next.js to load the new env vars.`;

    return jsonOk<ConfigurePublicUrlResponse>({
      ok: true,
      publicUrl: parsed.publicUrl,
      hostname: parsed.hostname,
      zone: parsed.zone,
      message,
      envLocalPath,
      created,
    });
  } catch (error) {
    return handleError(error);
  }
}
