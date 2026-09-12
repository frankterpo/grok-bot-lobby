import { JoinFlow } from "@/components/lobby/join-flow";

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinFlow code={code.toUpperCase()} />;
}
