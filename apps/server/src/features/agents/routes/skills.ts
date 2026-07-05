/*
  Skill import route. Pulls a skill's SKILL.md from a public GitHub repo and
  returns it as an AgentSkillInput the wizard can drop straight into the draft.
*/

import { Router } from "express";
import type { SkillImportResponse } from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import {
  fetchGithubSkill,
  GithubSkillError,
  type GithubSkillErrorCode,
} from "../../../infra/github/skill-fetch";

export const skillsRoutes = Router();

const MESSAGES: Record<GithubSkillErrorCode, string> = {
  invalid_source: "That isn't a GitHub repo or an owner/repo/slug.",
  no_skill_md: "No SKILL.md found at that location.",
  invalid_frontmatter: "SKILL.md is missing a `name` in its frontmatter.",
  github_not_found: "Repo or path not found on GitHub.",
  github_rate_limited: "GitHub rate limit hit — set GITHUB_TOKEN and retry.",
  github_failed: "Couldn't reach GitHub. Try again.",
};

// POST /api/agents/skills/import
skillsRoutes.post(
  "/skills/import",
  requireAuth,
  asyncHandler(async (req, res) => {
    const source = typeof req.body?.source === "string" ? req.body.source : "";
    if (!source.trim()) {
      res.status(400).json({ error: "source is required" });
      return;
    }
    try {
      const s = await fetchGithubSkill(source);
      const body: SkillImportResponse = {
        skill: {
          name: s.name,
          description: s.description,
          markdown: s.markdown,
          source: "repo",
          repoUrl: s.repoUrl,
          repoPath: s.repoPath,
        },
      };
      res.json(body);
    } catch (err) {
      if (err instanceof GithubSkillError) {
        res.status(422).json({ error: MESSAGES[err.code] });
        return;
      }
      throw err;
    }
  }),
);
