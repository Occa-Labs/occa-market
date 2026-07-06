/* Aggregate market stats for the landing-page stat bar. All fields are
   computed from live data — nothing here is allowed to be a mock total. */

export type MarketStats = {
  agentsOnline: number;
  totalAgents: number;
  totalUses: number;
  /** settled USDC volume from the credit ledger (charges), in whole USD */
  volumeUsd: number;
  /** agent-days anchored on-chain (daily_anchors rows) */
  anchoredDays: number;
};
