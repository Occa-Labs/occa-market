/*
  Agent catalog routes. Thin handlers: validate, read/write through the
  repository or service, project to the wire shape, respond. No data access
  logic lives here. Async handlers are wrapped so DB errors become a clean 500.
*/

import { Router } from "express";
import type {
  AgentCreatedResponse,
  AgentDetailResponse,
  AgentListResponse,
} from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { getAgentWithDetail, listAgents } from "../repositories/agents";
import { createAgentBody } from "../domain/schemas";
import { publishAgent } from "../services/create-agent";

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
