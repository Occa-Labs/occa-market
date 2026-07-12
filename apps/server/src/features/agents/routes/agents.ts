/*
  Agent catalog routes. Thin handlers: validate, read/write through the
  repository or service, project to the wire shape, respond. No data access
  logic lives here. Async handlers are wrapped so DB errors become a clean 500.

  Ownership: publishing stamps the caller as owner; source/update/mine are
  owner-scoped. Rows that predate the owner column (owner null) stay editable
  by any signed-in user until claimed.
*/

import { Router } from "express";
import {
  microsToUsd,
  type AgentCreatedResponse,
  type AgentDetailResponse,
  type AgentListResponse,
  type AgentSettlement,
  type AgentSourceResponse,
} from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { readVault, settlementCluster } from "../../../infra/onchain/settlement";
import {
  getAgentRow,
  getAgentWithDetail,
  listAgents,
  listAgentsByOwner,
} from "../repositories/agents";
import { createAgentBody, updateAgentBody } from "../domain/schemas";
import { checkPublishGate, checkReviseGate } from "../../token/services/standing";
import { publishAgent } from "../services/create-agent";
import { reviseAgent } from "../services/update-agent";
import { maskToolConfigs } from "../services/tool-secrets";

export const agentsRoutes = Router();

// GET /api/agents — the catalog feed.
agentsRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const body: AgentListResponse = { agents: await listAgents() };
    res.json(body);
  }),
);

// GET /api/agents/mine — the caller's published agents. Registered before
// /:id so "mine" never resolves as an agent id.
agentsRoutes.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body: AgentListResponse = {
      agents: await listAgentsByOwner(req.user!.userId),
    };
    res.json(body);
  }),
);

// POST /api/agents — publish a new agent from the build wizard.
agentsRoutes.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createAgentBody.safeParse(req.body);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "invalid body";
      res.status(400).json({ ok: false, error });
      return;
    }

    // Builder gate: publishing a new agent requires the 1M publisher bar.
    // The client front-gates the wizard on the same standing, so this is the
    // backstop. Skin in the game is the spam filter.
    const gate = await checkPublishGate(req.user!.userId);
    if (!gate.allowed) {
      res.status(403).json({ ok: false, error: gate.code, standing: gate.standing });
      return;
    }

    const result = await publishAgent(parsed.data, req.user!.userId);
    if (!result.ok) {
      res.status(409).json(result);
      return;
    }

    const body: AgentCreatedResponse = {
      agent: result.agent,
      seeded: result.seeded,
      seedReason: result.seedReason,
    };
    res.status(201).json(body);
  }),
);

// GET /api/agents/:id/source — the editable source, for the edit wizard.
// Internal content included (skill markdown, tool configs). Secrets are
// write-only: the runtime's apiKey is withheld (blank on update = keep), and
// tool-config env/header values come back masked — resubmitting the mask
// keeps the stored value.
agentsRoutes.get(
  "/:id/source",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getAgentRow(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (row.ownerUserId && row.ownerUserId !== req.user!.userId) {
      res.status(403).json({ error: "not your agent" });
      return;
    }
    const body: AgentSourceResponse = {
      source: {
        name: row.name,
        handle: row.handle,
        glyph: row.glyph,
        category: row.category,
        tagline: row.tagline,
        persona: row.detail.longDescription,
        pricePerMsg: row.pricePerMsg,
        skills: row.skillSources,
        tools: maskToolConfigs(row.toolConfigs),
        // pre-rework rows store steps as plain strings — same normalization
        // the public detail read applies
        workflow: (row.detail.workflow ?? []).map((s) =>
          typeof s === "string" ? { text: s, uses: [] } : s,
        ),
        runtime: row.runtime
          ? {
              adapterType: row.runtime.adapterType,
              gatewayUrl: row.runtime.gatewayUrl,
              model: row.runtime.model,
              externalAgentId: row.runtime.externalAgentId,
            }
          : null,
      },
    };
    res.json(body);
  }),
);

// PUT /api/agents/:id — revise a published agent and re-seed its workspace.
agentsRoutes.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Ownership first — a non-owner learns nothing, not even whether the
    // body would have validated.
    const row = await getAgentRow(req.params.id);
    if (row && row.ownerUserId && row.ownerUserId !== req.user!.userId) {
      res.status(403).json({ ok: false, error: "not your agent" });
      return;
    }

    // Revising a listing keeps the lighter membership gate, not the 1M
    // build bar — dumping every token shouldn't keep the keys, but editing
    // what you own shouldn't demand the full builder stake either.
    const gate = await checkReviseGate(req.user!.userId);
    if (!gate.allowed) {
      res.status(403).json({ ok: false, error: gate.code, standing: gate.standing });
      return;
    }

    const parsed = updateAgentBody.safeParse(req.body);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "invalid body";
      res.status(400).json({ ok: false, error });
      return;
    }

    const result = await reviseAgent(req.params.id, parsed.data);
    if (!result.ok) {
      res.status(result.error === "unknown agent" ? 404 : 409).json(result);
      return;
    }

    const body: AgentCreatedResponse = {
      agent: result.agent,
      seeded: result.seeded,
      seedReason: result.seedReason,
    };
    res.json(body);
  }),
);

// GET /api/agents/:id — one agent plus its detail record.
agentsRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await getAgentWithDetail(req.params.id);
    if (!result) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const body: AgentDetailResponse = result;
    res.json(body);
  }),
);

// GET /api/agents/:id/settlement — the agent's on-chain vault (accrued +
// claimed), public and read-only. `{ settlement: null }` when settlement is
// off or the agent has no vault yet. Vault data is public on-chain anyway.
agentsRoutes.get(
  "/:id/settlement",
  asyncHandler(async (req, res) => {
    const row = await getAgentRow(req.params.id);
    const agentPubkey = row?.onchain?.agentPubkey;
    if (!agentPubkey) {
      res.json({ settlement: null });
      return;
    }
    const vault = await readVault(agentPubkey);
    const settlement: AgentSettlement | null = vault
      ? {
          vault: vault.vault,
          cluster: settlementCluster(),
          accruedUsd: microsToUsd(vault.accruedMicros),
          claimedProviderUsd: microsToUsd(vault.claimedProviderMicros),
          claimedFeeUsd: microsToUsd(vault.claimedFeeMicros),
          providerWallet: vault.providerWallet,
        }
      : null;
    res.json({ settlement });
  }),
);
