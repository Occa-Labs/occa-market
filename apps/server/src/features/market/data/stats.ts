/*
  Market-level aggregate stats for the landing-page stat bar. Online/total/uses
  are derived from the live catalog; volume + provider count are mock totals
  until real settlement data lands.
*/

import type { MarketStats } from "@occa-market/shared";
import { listAgents } from "../../agents/repositories/agents";

const MOCK_VOLUME_USD = 41280;
const MOCK_PROVIDERS = 1;

export async function computeMarketStats(): Promise<MarketStats> {
  const agents = await listAgents();
  return {
    agentsOnline: agents.filter((a) => a.status === "online").length,
    totalAgents: agents.length,
    totalUses: agents.reduce((sum, a) => sum + a.uses, 0),
    volumeUsd: MOCK_VOLUME_USD,
    providers: MOCK_PROVIDERS,
  };
}
