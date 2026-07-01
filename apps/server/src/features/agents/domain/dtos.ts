/*
  DTO mappers — pure projections from the stored DB row to the wire MarketAgent
  shape. The `available` flag is computed here from config, never stored.
*/

import type { MarketAgent } from "@occa-market/shared";
import type { AgentRow } from "../../../infra/database/schema";
import { isAvailable } from "./availability";

export function toMarketAgent(row: AgentRow): MarketAgent {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    glyph: row.glyph,
    tagline: row.tagline,
    category: row.category,
    status: row.status,
    pricePerMsg: row.pricePerMsg,
    reputation: row.reputation,
    uses: row.uses,
    provider: row.provider,
    seed: row.seed,
    accent: row.accent,
    available: isAvailable(row.id),
  };
}
