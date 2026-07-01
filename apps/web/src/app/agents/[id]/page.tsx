import { notFound } from "next/navigation";
import { getAgentDetail } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgentDetail } from "@/components/agent-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getAgentDetail(id);
  if (!record) return { title: "Agent not found · OCCA Open Market" };
  return {
    title: `${record.agent.name} · OCCA Open Market`,
    description: record.agent.tagline,
  };
}

export default async function AgentPage({
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
        <AgentDetail agent={record.agent} detail={record.detail} />
      </main>
      <SiteFooter />
    </div>
  );
}
