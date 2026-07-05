/* Presentation formatters. Pure, view-only. */

/** Compact a run/use count: 18420 -> "18.4k". */
export function formatUses(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Whole-token amount with thousand separators: 1000000 -> "1,000,000". */
export function formatTokens(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

/** Short day for the weekly reset: "Mon, Jul 13". */
export function formatResetDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
