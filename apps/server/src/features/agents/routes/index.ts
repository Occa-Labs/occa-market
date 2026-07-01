/*
  Agents feature router — composes the resource routers under one mount point.
  Mounted at /api/agents by the server's composition root.
*/

import { Router } from "express";
import { agentsRoutes } from "./agents";
import { messagesRoutes } from "./messages";

export const agentsFeatureRouter = Router();

// messages first: its /:id/messages path is more specific than agents' /:id.
agentsFeatureRouter.use("/", messagesRoutes);
agentsFeatureRouter.use("/", agentsRoutes);
