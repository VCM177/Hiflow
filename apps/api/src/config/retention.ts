export const DEFAULT_RETENTION_MONTHS = 12;
const MAX_RETENTION_MONTHS = 120;

/**
 * How many months a candidate's data is kept after their last activity. An
 * unset or empty value means the default; anything else must be a whole number
 * of months, so a typo cannot silently shorten the period.
 */
export function retentionMonths(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_RETENTION_MONTHS;

  const months = Number(value);
  if (
    !Number.isInteger(months) ||
    months < 1 ||
    months > MAX_RETENTION_MONTHS
  ) {
    throw new Error(
      `CANDIDATE_RETENTION_MONTHS must be a whole number from 1 to ${MAX_RETENTION_MONTHS} (got ${value})`,
    );
  }

  return months;
}
