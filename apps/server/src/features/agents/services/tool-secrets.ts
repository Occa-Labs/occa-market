/*
  Write-only tool secrets — the owner-facing side of encryption at rest.

  MCP configs conventionally carry credentials in top-level `env` (stdio
  servers) and `headers` (remote servers). The source endpoint never returns
  those values: it returns a last-4 mask (…4f2a) so the owner can tell WHICH
  key is saved without ever seeing it again. On revise, a value still wearing
  the mask means "keep what's stored" and is restored from the saved row
  before anything is persisted or seeded to the gateway.

  Values outside env/headers (command, args, url) stay visible — they're
  structure the owner needs to edit, not secrets; the wizard copy tells
  publishers to keep keys in env. A key smuggled into args is the publisher's
  own call and rides unmasked.
*/

import type { AgentToolInput } from "@occa-market/shared";
import { maskSecret } from "../../../infra/crypto/secrets";

const SECRET_CONTAINERS = ["env", "headers"] as const;

// maskSecret output always begins with the ellipsis; real credentials never
// do, which is what makes the mask a safe "keep stored" sentinel.
const MASK_PREFIX = "…";

function isMasked(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(MASK_PREFIX);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Owner-facing projection: env/header values reduced to a last-4 mask. */
export function maskToolConfigs(tools: AgentToolInput[]): AgentToolInput[] {
  return tools.map((tool) => {
    const config = { ...tool.config };
    for (const container of SECRET_CONTAINERS) {
      const values = asRecord(config[container]);
      if (!values) continue;
      config[container] = Object.fromEntries(
        Object.entries(values).map(([key, value]) =>
          typeof value === "string" && value.length > 0
            ? [key, maskSecret(value)]
            : [key, value],
        ),
      );
    }
    return { name: tool.name, config };
  });
}

/**
 * Put stored secrets back where a submitted config still wears the mask.
 * Matched by tool name; a masked value with no stored counterpart (new or
 * renamed tool, or a fresh publish) is an explicit error, never saved as-is.
 */
export function restoreToolSecrets(
  submitted: AgentToolInput[],
  stored: AgentToolInput[],
): { ok: true; tools: AgentToolInput[] } | { ok: false; error: string } {
  const storedByName = new Map(stored.map((t) => [t.name, t]));
  const tools: AgentToolInput[] = [];
  for (const tool of submitted) {
    const config = { ...tool.config };
    for (const container of SECRET_CONTAINERS) {
      const values = asRecord(config[container]);
      if (!values || !Object.values(values).some(isMasked)) continue;
      const kept = asRecord(storedByName.get(tool.name)?.config[container]);
      const restored: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        if (!isMasked(value)) {
          restored[key] = value;
          continue;
        }
        const storedValue = kept?.[key];
        if (typeof storedValue !== "string") {
          return {
            ok: false,
            error: `tool "${tool.name}": ${container}.${key} is masked but has no saved value — enter the real value`,
          };
        }
        restored[key] = storedValue;
      }
      config[container] = restored;
    }
    tools.push({ name: tool.name, config });
  }
  return { ok: true, tools };
}
