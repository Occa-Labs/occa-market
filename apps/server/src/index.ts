/*
  Composition root — wires config, middleware, and feature routers into the
  Express app and starts listening. Mirrors OCCA's apps/server/src/index.ts:
  features are mounted under URL prefixes here, nowhere else.
*/

import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { agentsFeatureRouter } from "./features/agents/routes";
import { authRoutes } from "./features/auth/routes";
import { statsRouter } from "./features/market/routes/stats";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/agents", agentsFeatureRouter);
app.use("/api/stats", statsRouter);

app.listen(env.port, () => {
  console.log(`[server] OCCA Open Market API listening on :${env.port}`);
});
