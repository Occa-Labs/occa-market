import { getMarketStats, listAgents } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { Catalog } from "@/components/catalog";
import { SiteFooter } from "@/components/site-footer";

// Catalog + stats are live data from the API server, fetched per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [agents, stats] = await Promise.all([listAgents(), getMarketStats()]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Hero stats={stats} />
        <Catalog agents={agents} />
      </main>
      <SiteFooter />
    </div>
  );
}
