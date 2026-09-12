import {
  createHostSessionToken,
  hostSessionCookie,
  resolveHostSecret,
  verifyHostSecret,
} from "@/lib/host-auth";
import { handleError, isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { HOST_USER_ID } from "@/lib/domain";
import { writeIdentityCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    if (!resolveHostSecret()) {
      return jsonError("Host login is not configured. Set HOST_SECRET on the Worker.", 503);
    }

    const body = await readJson(request);
    const secret =
      isRecord(body) && typeof body.secret === "string"
        ? body.secret
        : request.headers.get("x-lobby-host-secret");

    if (!verifyHostSecret(secret)) {
      return jsonError("Invalid host secret.", 403);
    }

    const token = await createHostSessionToken(HOST_USER_ID);
    if (!token) {
      return jsonError("Could not create host session.", 500);
    }

    await writeIdentityCookie("you", HOST_USER_ID);

    return jsonOk(
      { ok: true, role: "host" as const },
      {
        headers: {
          "Set-Cookie": hostSessionCookie(token),
        },
      },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    if (!resolveHostSecret()) {
      return jsonError("Host login is not configured. Set HOST_SECRET on the Worker.", 503);
    }

    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") ?? request.headers.get("x-lobby-host-secret");
    if (!verifyHostSecret(secret)) {
      return jsonError("Invalid host secret.", 403);
    }

    const token = await createHostSessionToken(HOST_USER_ID);
    if (!token) {
      return jsonError("Could not create host session.", 500);
    }

    await writeIdentityCookie("you", HOST_USER_ID);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": hostSessionCookie(token),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
