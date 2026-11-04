import {
  auditEventLabel,
  type AuditEventView,
  type AuditRowChangeView,
} from '@hiflow/shared-types';
import type { AuditEvent } from './entities/audit-event.entity';
import type { AuditRowChange } from './entities/audit-row-change.entity';

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
