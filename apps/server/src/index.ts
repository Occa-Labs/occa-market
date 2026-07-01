/*
  Composition root — wires config, middleware, and feature routers into the
  Express app and starts listening. Mirrors OCCA's apps/server/src/index.ts:
  features are mounted under URL prefixes here, nowhere else.
*/

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
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

// Global error handler — async route rejections (e.g. DB errors) land here as a
// clean 500 instead of crashing the process. Must be last, and take 4 args.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal server error" });
});

app.listen(env.port, () => {
  console.log(`[server] OCCA Open Market API listening on :${env.port}`);
});
