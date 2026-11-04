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
