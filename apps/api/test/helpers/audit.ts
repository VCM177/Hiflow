import type { E2eContext } from './e2e-app';

export interface AuditEventRow {
  event: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  tx_id: string;
  request_id: string | null;
  origin: string;
  ip: string | null;
  user_agent: string | null;
  data: Record<string, unknown>;
}

export interface RowChangeRow {
  op: 'I' | 'U' | 'D';
  table_name: string;
  row_id: string;
  changes: Record<string, unknown>;
  actor_id: string | null;
}

/** Events recorded for one entity (or one event name), oldest first. */
export function auditEvents(
  ctx: E2eContext,
  filter: { entityId?: string; event?: string; since?: Date },
): Promise<AuditEventRow[]> {
  return ctx.maintenance.query<AuditEventRow[]>(
    `SELECT event, entity_type, entity_id, actor_id, actor_name, actor_role,
            tx_id, request_id, origin, host(ip) AS ip, user_agent, data
     FROM audit_events
     WHERE ($1::uuid IS NULL OR entity_id = $1)
       AND ($2::text IS NULL OR event = $2)
       AND ($3::timestamptz IS NULL OR occurred_at >= $3)
     ORDER BY occurred_at, id`,
    [filter.entityId ?? null, filter.event ?? null, filter.since ?? null],
  );
}

/** What the triggers recorded in the transaction that wrote `event`. */
export function rowChanges(
  ctx: E2eContext,
  event: AuditEventRow,
): Promise<RowChangeRow[]> {
  return ctx.maintenance.query<RowChangeRow[]>(
    `SELECT op, table_name, row_id, changes, actor_id
     FROM audit_row_changes WHERE tx_id = $1 ORDER BY id`,
    [event.tx_id],
  );
}

/** The database's own clock, so "since" is not skewed by this machine's. */
export async function dbNow(ctx: E2eContext): Promise<Date> {
  const rows = await ctx.maintenance.query<{ now: Date }[]>(
    `SELECT clock_timestamp() AS now`,
  );
  return rows[0].now;
}
