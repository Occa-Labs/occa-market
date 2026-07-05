/*
  Holder tier badge — the identity half of the tier system (token doc §6.8).
  A quiet mono pill in the house style: grayscale, hairline border; higher
  tiers read through border/text weight, never through color.
*/

import { tierSpec, type HolderTier } from "@occa-market/shared";

export function TierBadge({ tier }: { tier: HolderTier }) {
  const spec = tierSpec(tier);
  if (!spec) return null;
  const top = tier === "whale" || tier === "elite";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-surface-2 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] ${
        top ? "border-line-strong text-fg" : "border-line text-muted"
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${top ? "bg-fg" : "bg-faint"}`}
      />
      {spec.label}
    </span>
  );
}
