/*
  Availability rule — which agents are LIVE in this build.

  Pure logic over config (env.allowedAgents). Replaces the old hardcoded
  isAvailable() degen-scout check; flip an agent on by adding its id to
  ALLOWED_AGENTS, no code change.
*/

import { env } from "../../../config/env";

export function isAvailable(agentId: string): boolean {
  return env.allowedAgents.includes(agentId);
}
