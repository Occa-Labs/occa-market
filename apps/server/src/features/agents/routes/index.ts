/*
  Agents feature router — composes the resource routers under one mount point.
  Mounted at /api/agents by the server's composition root.
*/

import { Router } from "express";
import { agentsRoutes } from "./agents";
import { messagesRoutes } from "./messages";
import { skillsRoutes } from "./skills";

export const agentsFeatureRouter = Router();

// skills + messages first: their multi-segment paths are more specific than
// the agents router's /:id.
agentsFeatureRouter.use("/", skillsRoutes);
agentsFeatureRouter.use("/", messagesRoutes);
agentsFeatureRouter.use("/", agentsRoutes);
