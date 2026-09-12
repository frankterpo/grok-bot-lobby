import { getPublicUrlStatus } from "@/lib/format";
import { handleError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") ?? undefined;
    return jsonOk(getPublicUrlStatus({ request, code }));
  } catch (error) {
    return handleError(error);
  }
}
