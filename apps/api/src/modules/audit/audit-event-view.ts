import { auditEventLabel } from '@hiflow/shared-types';
import type { AuditEvent } from './entities/audit-event.entity';
import type { AuditRowChange } from './entities/audit-row-change.entity';

export interface AuditEventView {
  id: string;
  occurredAt: string;
  event: string;
  /** The Vietnamese label of the event, for the screen. */
  label: string;
  entityType: string;
  entityId: string | null;
  /** The actor as they were at that moment; null id for a visitor or a failed login. */
  actor: { id: string | null; name: string | null; role: string | null };
  txId: string;
  requestId: string | null;
  origin: string;
  ip: string | null;
  userAgent: string | null;
  data: Record<string, unknown>;
}

export interface AuditRowChangeView {
  id: string;
  op: 'I' | 'U' | 'D';
  tableName: string;
  rowId: string;
  /** Insert: `{column: new}`. Update: `{column: [old, new]}`. Delete: `{column: old}`. */
  changes: Record<string, unknown>;
}

export interface AuditEventDetail extends AuditEventView {
  /** What the database triggers saw change in the same transaction. */
  rowChanges: AuditRowChangeView[];
}

export const toAuditEventView = (e: AuditEvent): AuditEventView => ({
  id: e.id,
  occurredAt: e.occurredAt.toISOString(),
  event: e.event,
  label: auditEventLabel(e.event),
  entityType: e.entityType,
  entityId: e.entityId,
  actor: { id: e.actorId, name: e.actorName, role: e.actorRole },
  txId: e.txId,
  requestId: e.requestId,
  origin: e.origin,
  ip: e.ip,
  userAgent: e.userAgent,
  data: e.data,
});

export const toAuditRowChangeView = (
  c: AuditRowChange,
): AuditRowChangeView => ({
  id: c.id,
  op: c.op,
  tableName: c.tableName,
  rowId: c.rowId,
  changes: c.changes,
});

/** One flat row per event, for the CSV export. */
export interface AuditEventCsvRow {
  occurredAt: string;
  label: string;
  event: string;
  actor: string;
  role: string;
  entityType: string;
  entityId: string;
  origin: string;
  ip: string;
  data: string;
}

export const toAuditCsvRow = (v: AuditEventView): AuditEventCsvRow => ({
  occurredAt: v.occurredAt,
  label: v.label,
  event: v.event,
  actor: v.actor.name ?? '',
  role: v.actor.role ?? '',
  entityType: v.entityType,
  entityId: v.entityId ?? '',
  origin: v.origin,
  ip: v.ip ?? '',
  data: Object.keys(v.data).length > 0 ? JSON.stringify(v.data) : '',
});
