import { notFound } from "next/navigation";
import { getAgentDetail } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgentBuilder } from "@/components/agent-builder";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getAgentDetail(id);
  if (!record) return { title: "Agent not found · OCCA Open Market" };
  return { title: `Edit · ${record.agent.name} · OCCA Open Market` };
}

export default async function EditAgentPage({
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
        <AgentBuilder editId={id} />
      </main>
      <SiteFooter />
    </div>
  );
}
