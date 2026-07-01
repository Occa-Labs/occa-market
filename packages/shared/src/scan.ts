/*
  New-pair scan config — shared because the server authors a launchScan block's
  data against these windows, and the web client island renders the window
  selector and per-window pairs-scanned totals from the same source.
*/

/** Selectable look-back windows for a new-pair scan, in hours. */
export const SCAN_WINDOWS = [1, 4, 8, 12, 24] as const;
export type ScanWindow = (typeof SCAN_WINDOWS)[number];

/** Rough pairs-scanned totals per window, for the result line. */
export const SCAN_COUNTS: Record<ScanWindow, number> = {
  1: 52,
  4: 210,
  8: 415,
  12: 620,
  24: 1243,
};
