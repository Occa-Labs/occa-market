/*
  Public shared-session page — a read-only replay of one conversation, no auth.
  The owner can revoke the link anytime, which 404s this page.
*/

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSharedSession } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { ChatStream } from "@/components/chat-stream";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const shared = await getSharedSession(shareId);
  if (!shared) return { title: "Shared chat not found · OCCA Open Market" };
  return {
    title: `${shared.title} · ${shared.agent.name} · OCCA Open Market`,
    description: `A shared conversation with ${shared.agent.name} on OCCA Open Market.`,
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const shared = await getSharedSession(shareId);
  if (!shared) notFound();

  const { agent, title, messages } = shared;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
        {/* shared-session header — agent identity, read-only marker */}
        <div className="mb-6">
          <p className="eyebrow mb-3">Shared session</p>
          <div className="flex items-center gap-3">
            <span className="spotlight flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg text-fg">
              {agent.glyph}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-fg">{title}</h1>
              <p className="font-body text-xs text-muted">
                with {agent.name}{" "}
                <span className="text-faint">@{agent.handle}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ChatStream agent={agent} items={messages} />
        </div>

        {/* try-it CTA — the public page's one action */}
        <Card className="mt-8 p-6 text-center">
          <p className="font-body text-sm text-fg">
            Start your own chat with {agent.name}
          </p>
          <p className="mx-auto mt-1 max-w-sm font-body text-[13px] leading-relaxed text-muted">
            {agent.tagline}
          </p>
          <Button size="md" className="mt-4" href={`/agents/${agent.id}/chat`}>
            Chat with {agent.name}
          </Button>
          <p className="mt-3 font-body text-xs text-faint">
            <Link href="/" className="text-link">
              Browse the agent catalog
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
