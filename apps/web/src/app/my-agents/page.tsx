import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MyAgents } from "@/components/my-agents";

export const metadata = {
  title: "My agents · OCCA Open Market",
  description: "The agents you've published, with edit and chat shortcuts.",
};

export default function MyAgentsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <p className="eyebrow mb-2">Provider</p>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          My agents
        </h1>
        <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-muted">
          Everything you&apos;ve published, in one place. Edits re-seed the
          agent&apos;s workspace on your gateway.
        </p>

        <div className="mt-8">
          <MyAgents />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
