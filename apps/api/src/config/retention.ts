export const DEFAULT_RETENTION_MONTHS = 12;
const MAX_RETENTION_MONTHS = 120;

/**
 * A retention period as a whole number of months. An unset or empty value means
 * the default; anything else must be a whole number in range, so a typo cannot
 * silently shorten the period.
 */
function wholeMonths(name: string, value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_RETENTION_MONTHS;

  const months = Number(value);
  if (
    !Number.isInteger(months) ||
    months < 1 ||
    months > MAX_RETENTION_MONTHS
  ) {
    throw new Error(
      `${name} must be a whole number from 1 to ${MAX_RETENTION_MONTHS} (got ${value})`,
    );
  }

  return months;
}

/** How long a candidate's data is kept after their last activity. */
export const retentionMonths = (value: string | undefined): number =>
  wholeMonths('CANDIDATE_RETENTION_MONTHS', value);

/** How long the audit trail keeps the IP address and user agent of an event. */
export const auditIpRetentionMonths = (value: string | undefined): number =>
  wholeMonths('AUDIT_IP_RETENTION_MONTHS', value);
