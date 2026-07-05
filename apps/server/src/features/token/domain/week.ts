/*
  Budget period math. The weekly budget resets Monday 00:00 UTC and the daily
  allowance resets every 00:00 UTC (token doc §4) — both computed on read, so
  there is no reset job to run or miss.
*/

/** Start of the current budget week: the most recent Monday 00:00 UTC. */
export function weekStart(now: Date = new Date()): Date {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday),
  );
}

/** When the current week's budget resets: next Monday 00:00 UTC. */
export function weekResetAt(now: Date = new Date()): Date {
  const start = weekStart(now);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/** Start of the current budget day: today 00:00 UTC. */
export function dayStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** When the daily allowance resets: next 00:00 UTC. */
export function dayResetAt(now: Date = new Date()): Date {
  return new Date(dayStart(now).getTime() + 24 * 60 * 60 * 1000);
}
