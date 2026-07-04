/*
  Gateway probe route. The build wizard's "Test connection" lands here: the
  browser can't reach a provider's gateway directly (CORS, private hosts), so
  the server probes /v1/health on its behalf and relays the verdict.

  MVP note: this proxies a caller-supplied URL (SSRF surface). Fine while the
  market runs locally; before a hosted deploy it needs an egress allowlist /
  private-range block.
*/

import { Router } from "express";
import type { GatewayHealthResponse } from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { gatewayHealth } from "../../../infra/gateway/client";
import { gatewayTargetSchema } from "../domain/schemas";

export const gatewayRoutes = Router();

// POST /api/agents/gateway/health
gatewayRoutes.post(
  "/gateway/health",
  asyncHandler(async (req, res) => {
    const parsed = gatewayTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
      return;
    }
    const { gatewayUrl, apiKey } = parsed.data;
    const body: GatewayHealthResponse = await gatewayHealth({ gatewayUrl, apiKey });
    res.json(body);
  }),
);
