/*
  Named tool catalog — the vetted MCP servers OCCA's own seed agents draw from.

  Seed-agent definitions reference tools by NAME; this catalog resolves the
  name to a concrete MCP config at seed time. One place to change a config
  (path, version pin, future API key injection from env) — every seed agent
  picks it up on its next re-seed, and nothing secret or host-specific is
  duplicated across agent rows.

  Community publishers are untouched: the wizard still takes raw MCP configs
  (BYORT). This catalog exists only for the agents WE operate.

  Entries are builders, not values, so env is read lazily and a key added
  later never leaks into rows seeded before it existed.
*/

import type { AgentToolInput } from "@occa-market/shared";
import { env } from "../../../../config/env";

const catalog: Record<string, () => Record<string, unknown>> = {
  // First-party toolbox (apps/mcp-tools, deployed to the gateway box).
  secscan: () => ({
    command: "node",
    args: [`${env.mcpToolsDir}/secscan.mjs`],
  }),
  chartlab: () => ({
    command: "node",
    args: [`${env.mcpToolsDir}/chartlab.mjs`],
  }),
  // Vetted third-party servers — always version-pinned, never floating `-y pkg`.
  dexpaprika: () => ({
    command: "npx",
    args: ["-y", "dexpaprika-mcp@2.1.1"],
  }),
};

export function resolveCatalogTools(names: string[]): AgentToolInput[] {
  return names.map((name) => {
    const build = catalog[name];
    if (!build) {
      throw new Error(
        `unknown catalog tool "${name}" — known: ${Object.keys(catalog).join(", ")}`,
      );
    }
    return { name, config: build() };
  });
}
