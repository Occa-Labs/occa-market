/* Presentation formatters. Pure, view-only. */

/** Compact a run/use count: 18420 -> "18.4k". */
export function formatUses(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
