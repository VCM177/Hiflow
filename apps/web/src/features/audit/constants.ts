import { AUDIT_EVENTS, type AuditEvent } from '@hiflow/shared-types';

export const AUDIT_EVENT_OPTIONS = (
  Object.keys(AUDIT_EVENTS) as AuditEvent[]
).map((event) => ({ value: event, label: AUDIT_EVENTS[event].label }));

export function isAuditEvent(value: unknown): value is AuditEvent {
  return typeof value === 'string' && value in AUDIT_EVENTS;
}

/** The kinds of record the trail speaks about, once each, as the catalogue names them. */
export const ENTITY_TYPE_OPTIONS = [
  ...new Set(Object.values(AUDIT_EVENTS).map((item) => item.entityType)),
].map((type) => ({ value: type, label: type }));

/** Where a change came from (`AUDIT_ORIGINS` in the API). */
export const ORIGIN_LABEL = {
  app: 'Ứng dụng',
  seed: 'Dữ liệu mẫu',
  maintenance: 'Bảo trì',
  e2e: 'Kiểm thử',
} as const;

export type AuditOrigin = keyof typeof ORIGIN_LABEL;

export const ORIGIN_OPTIONS = (Object.keys(ORIGIN_LABEL) as AuditOrigin[]).map(
  (origin) => ({ value: origin, label: ORIGIN_LABEL[origin] }),
);

export function isAuditOrigin(value: unknown): value is AuditOrigin {
  return typeof value === 'string' && value in ORIGIN_LABEL;
}

/** The most rows one CSV export holds (`AUDIT_EXPORT_ROW_LIMIT` in the API). */
export const EXPORT_ROW_LIMIT = 10_000;

export const ROW_OP_LABEL = {
  I: 'Thêm dòng',
  U: 'Sửa dòng',
  D: 'Xóa dòng',
} as const;
