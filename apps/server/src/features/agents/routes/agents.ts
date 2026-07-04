/*
  Agent catalog routes. Thin handlers: validate, read/write through the
  repository or service, project to the wire shape, respond. No data access
  logic lives here. Async handlers are wrapped so DB errors become a clean 500.

  Source/update are auth-gated but not yet owner-scoped — agents don't carry
  an owner column. Fine for the local MVP; ownership lands with the ledger.
*/

import { Router } from "express";
import type {
  AgentCreatedResponse,
  AgentDetailResponse,
  AgentListResponse,
  AgentSourceResponse,
} from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { getAgentRow, getAgentWithDetail, listAgents } from "../repositories/agents";
import { createAgentBody, updateAgentBody } from "../domain/schemas";
import { publishAgent } from "../services/create-agent";
import { reviseAgent } from "../services/update-agent";

export const agentsRoutes = Router();

// GET /api/agents — the catalog feed.
agentsRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const body: AgentListResponse = { agents: await listAgents() };
    res.json(body);
  }),
);

// POST /api/agents — publish a new agent from the build wizard.
agentsRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createAgentBody.safeParse(req.body);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "invalid body";
      res.status(400).json({ ok: false, error });
      return;
    }

    const result = await publishAgent(parsed.data);
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
// Internal content included (skill markdown, tool configs); the runtime's
// apiKey is withheld — leaving it blank on update keeps the stored one.
agentsRoutes.get(
  "/:id/source",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getAgentRow(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not found" });
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
        tools: row.toolConfigs,
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
