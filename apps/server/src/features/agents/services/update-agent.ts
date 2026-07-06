/*
  Revision flow — applies an edit to a published agent, then re-seeds its
  workspace on the gateway so the running agent picks up the new persona,
  skills, and tools. The handle (and so the id) never changes; earned state
  (reputation, uses, activity, sample output) is preserved, only the
  capability-derived parts of the detail document are rebuilt.
*/

import type { AgentRuntimeInput } from "@occa-market/shared";
import { gatewaySeed } from "../../../infra/gateway/client";
import { getAgentRow, updateAgentRow } from "../repositories/agents";
import type { UpdateAgentBody } from "../domain/schemas";
import { buildDetail, type PublishResult } from "./create-agent";
import { buildSeedFiles } from "./runtime/seed";
import { restoreToolSecrets } from "./tool-secrets";

export async function reviseAgent(
  id: string,
  input: UpdateAgentBody,
): Promise<PublishResult> {
  const row = await getAgentRow(id);
  if (!row) return { ok: false, error: "unknown agent" };

  // A blank apiKey on an edit means "keep the stored secret" — the source
  // endpoint never returns it, so the wizard can't echo it back.
  const runtime: AgentRuntimeInput = {
    ...input.runtime,
    apiKey: input.runtime.apiKey ?? row.runtime?.apiKey,
  };

  // Same write-only contract for tool configs: the source endpoint masks
  // env/header values, so a still-masked value here means "keep the stored
  // one" — swap the real secrets back in before saving or seeding.
  const restored = restoreToolSecrets(input.tools, row.toolConfigs);
  if (!restored.ok) return { ok: false, error: restored.error };
  input = { ...input, tools: restored.tools };

  const detail = {
    ...buildDetail(input),
    sampleOutput: row.detail.sampleOutput,
    examplePrompts: row.detail.examplePrompts,
    activity: row.detail.activity,
    uptime: row.detail.uptime,
    categoryRank: row.detail.categoryRank,
  };

  const agent = await updateAgentRow(id, {
    name: input.name,
    glyph: input.glyph,
    tagline: input.tagline,
    category: input.category,
    pricePerMsg: input.pricePerMsg,
    detail,
    skillSources: input.skills,
    toolConfigs: input.tools,
    runtime,
  });
  if (!agent) return { ok: false, error: "unknown agent" };

  // Same contract as publish: the row is already saved, so a failed push
  // reports as seeded:false and the workspace can be pushed again later.
  const seeded = await gatewaySeed(
    { gatewayUrl: runtime.gatewayUrl, apiKey: runtime.apiKey },
    runtime.externalAgentId,
    buildSeedFiles(agent, detail, input.skills, input.tools),
  );

  return { ok: true, agent, seeded: seeded.ok, seedReason: seeded.reason };
}
