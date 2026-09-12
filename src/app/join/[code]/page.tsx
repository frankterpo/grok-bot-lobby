import { headers } from "next/headers";

import { JoinFlow } from "@/components/lobby/join-flow";
import { originFromRequest } from "@/lib/format";

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = originFromRequest(
    new Request(`${proto}://${host.split(",")[0]!.trim()}/join/${code}`, { headers: headerList }),
  );
  return <JoinFlow code={code.toUpperCase()} publicOrigin={origin} />;
}
