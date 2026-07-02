/*
  Fetch a skill (its SKILL.md) from a public GitHub repo.

  Ported and trimmed from OCCA's features/skills/infra/skill-fetch.ts. Accepts an
  "owner/repo/slug" shorthand or a full github.com tree/blob URL, resolves the
  ref to a commit SHA, walks the repo tree to locate the skill directory, and
  returns the SKILL.md markdown + parsed frontmatter. Single-file only (no
  multi-file inventory/streaming — that's a later upgrade).

  GITHUB_TOKEN (config.githubToken) is optional but raises the anon rate limit
  (60 req/hr → 5000).
*/

import { env } from "../../config/env";

const SKILL_DIR_CONVENTION = "skills";
const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

export type GithubSkillErrorCode =
  | "invalid_source"
  | "no_skill_md"
  | "invalid_frontmatter"
  | "github_not_found"
  | "github_rate_limited"
  | "github_failed";

export class GithubSkillError extends Error {
  constructor(
    public code: GithubSkillErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export type FetchedSkill = {
  slug: string;
  name: string;
  description: string;
  markdown: string;
  /** Pinned source URL (github.com tree at the resolved commit). */
  repoUrl: string;
  /** Path to the skill directory within the repo. */
  repoPath: string;
};

type ParsedSource = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  slug: string;
};

function safeUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function parseSkillSource(input: string): ParsedSource {
  const trimmed = input.trim();
  if (!trimmed) throw new GithubSkillError("invalid_source", "empty");

  // Full GitHub URL — https://github.com/owner/repo/tree/ref/path/to/dir
  if (/^https?:\/\//i.test(trimmed)) {
    const url = safeUrl(trimmed);
    if (!url || url.hostname !== "github.com") {
      throw new GithubSkillError("invalid_source", "not a github.com URL");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new GithubSkillError("invalid_source", "missing owner/repo");
    }
    const [owner, repo, kind, ref, ...rest] = segments;
    if (kind && kind !== "tree" && kind !== "blob") {
      throw new GithubSkillError("invalid_source", "unsupported URL shape");
    }
    const path = rest.join("/").replace(/\/$/, "");
    if (!path) {
      throw new GithubSkillError("invalid_source", "URL must point to a skill directory");
    }
    return { owner, repo, path, ref: ref || undefined, slug: rest[rest.length - 1]! };
  }

  // Shorthand — "owner/repo/slug" → path "skills/<slug>"
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length !== 3) {
    throw new GithubSkillError("invalid_source", "shorthand must be owner/repo/slug");
  }
  const [owner, repo, slug] = parts;
  return { owner, repo, path: `${SKILL_DIR_CONVENTION}/${slug}`, slug };
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "occa-market-server",
  };
  if (env.githubToken) h.Authorization = `Bearer ${env.githubToken}`;
  return h;
}

async function githubFetch(url: string): Promise<Response> {
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) throw new GithubSkillError("github_not_found", url);
  if (res.status === 403 || res.status === 429) {
    throw new GithubSkillError("github_rate_limited", url);
  }
  if (!res.ok) {
    throw new GithubSkillError("github_failed", `${res.status} ${res.statusText} ${url}`);
  }
  return res;
}

async function resolveRefToSha(
  owner: string,
  repo: string,
  ref: string | undefined,
): Promise<string> {
  if (ref && /^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
  if (!ref) {
    const res = await githubFetch(`${GITHUB_API}/repos/${owner}/${repo}`);
    const json = (await res.json()) as { default_branch?: string };
    ref = json.default_branch ?? "main";
  }
  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
  );
  const json = (await res.json()) as { sha?: string };
  if (!json.sha) throw new GithubSkillError("github_failed", "no sha on commit response");
  return json.sha;
}

type TreeEntry = { path: string; type: "blob" | "tree" };

async function fetchTree(owner: string, repo: string, sha: string): Promise<TreeEntry[]> {
  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
  );
  const json = (await res.json()) as { tree?: TreeEntry[] };
  return json.tree ?? [];
}

async function fetchRaw(
  owner: string,
  repo: string,
  sha: string,
  path: string,
): Promise<string> {
  const res = await githubFetch(`${GITHUB_RAW}/${owner}/${repo}/${sha}/${path}`);
  return res.text();
}

function parseFrontmatter(source: string): { name?: string; description?: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: { name?: string; description?: string } = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (m[1].trim() === "name") result.name = value;
    else if (m[1].trim() === "description") result.description = value;
  }
  return result;
}

export async function fetchGithubSkill(source: string): Promise<FetchedSkill> {
  const parsed = parseSkillSource(source);
  const sha = await resolveRefToSha(parsed.owner, parsed.repo, parsed.ref);
  const tree = await fetchTree(parsed.owner, parsed.repo, sha);

  // The conventional `skills/<slug>` path is only a default — repos also keep
  // skills at the root (`<slug>/SKILL.md`) or nested. If the conventional path
  // has no files, discover the dir by a SKILL.md whose parent is the slug.
  const prefixFor = (p: string) => (p.endsWith("/") ? p : `${p}/`);
  let skillPath = parsed.path;
  if (!tree.some((e) => e.type === "blob" && e.path.startsWith(prefixFor(skillPath)))) {
    const discovered = tree
      .filter(
        (e) =>
          e.type === "blob" &&
          (e.path === `${parsed.slug}/SKILL.md` ||
            e.path.endsWith(`/${parsed.slug}/SKILL.md`)),
      )
      .map((e) => e.path.slice(0, -"/SKILL.md".length))
      .sort((a, b) => a.split("/").length - b.split("/").length);
    if (discovered.length > 0) skillPath = discovered[0];
  }

  const skillMdPath = `${skillPath}/SKILL.md`;
  if (!tree.some((e) => e.type === "blob" && e.path === skillMdPath)) {
    throw new GithubSkillError("no_skill_md", `no SKILL.md under ${parsed.path}`);
  }

  const markdown = await fetchRaw(parsed.owner, parsed.repo, sha, skillMdPath);
  const { name, description } = parseFrontmatter(markdown);
  if (!name) {
    throw new GithubSkillError("invalid_frontmatter", "SKILL.md missing `name` in frontmatter");
  }

  return {
    slug: parsed.slug,
    name,
    description: description ?? "",
    markdown,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}/tree/${sha}/${skillPath}`,
    repoPath: skillPath,
  };
}
