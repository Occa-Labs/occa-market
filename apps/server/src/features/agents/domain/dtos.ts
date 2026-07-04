/*
  DTO mappers — pure projections from the stored DB row to the wire MarketAgent
  shape. The `available` flag is computed here from config, never stored.
*/

import type { MarketAgent } from "@occa-market/shared";
import type { AgentRow } from "../../../infra/database/schema";
import { isAvailable } from "./availability";

export function toMarketAgent(row: AgentRow): MarketAgent {
  // An agent that brought its own runtime (BYORT binding) is live: its
  // provider's gateway serves it. A down gateway surfaces as a run error;
  // health-derived status (flip to offline when the gateway drops) comes
  // with the connection prober later.
  const byort = row.runtime != null;
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    glyph: row.glyph,
    tagline: row.tagline,
    category: row.category,
    status: byort ? "online" : row.status,
    pricePerMsg: row.pricePerMsg,
    reputation: row.reputation,
    uses: row.uses,
    provider: row.provider,
    seed: row.seed,
    accent: row.accent,
    available: byort || isAvailable(row.id),
  };
}
