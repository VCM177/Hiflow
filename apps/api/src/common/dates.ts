/** Start of the day a `YYYY-MM-DD` (or ISO) string falls on, in UTC. */
export function startOfDay(value: string): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Exclusive upper bound for "up to and including this day": midnight at the
 * start of the following day, so a `<` comparison covers the whole day.
 */
export function endOfDayExclusive(value: string): Date {
  const date = startOfDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** Keeps only the `YYYY-MM-DD` part, the form a Postgres `date` column takes. */
export function toDateOnly(value: string): string {
  return value.slice(0, 10);
}
