import { notFound } from "next/navigation";
import { getAgentDetail } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { AgentChat } from "@/components/agent-chat";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getAgentDetail(id);
  if (!record) return { title: "Agent not found · OCCA Open Market" };
  return { title: `Chat · ${record.agent.name} · OCCA Open Market` };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getAgentDetail(id);
  if (!record) notFound();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <AgentChat
          agent={record.agent}
          examplePrompts={record.detail.examplePrompts}
        />
      </main>
    </div>
  );
}
