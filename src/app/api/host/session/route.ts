import { hostSessionFromRequest } from "@/lib/host-auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await hostSessionFromRequest(request);
  return jsonOk({
    authenticated: session !== null,
    role: session?.role ?? null,
  });
}
