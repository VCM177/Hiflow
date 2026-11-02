import type { DataSource } from 'typeorm';

export interface AuditPurgeResult {
  /** Copies of an erased candidate's data in the row-level trail. */
  candidateCopies: number;
  /** Old events whose IP address and user agent are due to be blanked. */
  expiredAddresses: number;
}

/** Narrows a run to some of what it would touch; a real run uses none. */
export interface AuditPurgeScope {
  candidateIds?: string[];
  origin?: string;
}

/**
 * What the application role cannot do to the trail, done as the owner:
 *
 * - once a candidate is anonymised, the row-level trail still holds the values
 *   that were erased (it stores real values); those copies go, and the event
 *   that says the erasure happened stays;
 * - an IP address and user agent are only kept for `ipMonths` months; the rest
 *   of the event is kept.
 */
export async function purgeAuditCopies(
  owner: DataSource,
  ipMonths: number,
  dryRun = false,
  scope: AuditPurgeScope = {},
): Promise<AuditPurgeResult> {
  return owner.transaction(async (manager) => {
    await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);

    const copies = `table_name = 'candidates' AND row_id IN
       (SELECT id FROM candidates WHERE anonymized_at IS NOT NULL
          AND ($1::uuid[] IS NULL OR id = ANY($1)))`;
    const expired = `occurred_at < now() - make_interval(months => $1)
       AND (ip IS NOT NULL OR user_agent IS NOT NULL)
       AND ($2::text IS NULL OR origin = $2)`;
    const candidateIds = scope.candidateIds ?? null;
    const origin = scope.origin ?? null;

    if (dryRun) {
      const [{ n: candidateCopies }] = await manager.query<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM audit_row_changes WHERE ${copies}`,
        [candidateIds],
      );
      const [{ n: expiredAddresses }] = await manager.query<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM audit_events WHERE ${expired}`,
        [ipMonths, origin],
      );
      return { candidateCopies, expiredAddresses };
    }

    const [, candidateCopies] = await manager.query<[unknown, number]>(
      `DELETE FROM audit_row_changes WHERE ${copies}`,
      [candidateIds],
    );
    const [, expiredAddresses] = await manager.query<[unknown, number]>(
      `UPDATE audit_events SET ip = NULL, user_agent = NULL WHERE ${expired}`,
      [ipMonths, origin],
    );

    return { candidateCopies, expiredAddresses };
  });
}
