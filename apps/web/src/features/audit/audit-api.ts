import type {
  AuditEventDetail,
  AuditEventView,
  Jsonified,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';
import { downloadFile } from '@/lib/api/download';

export type AuditEventRow = Jsonified<AuditEventView>;
export type AuditEventFull = Jsonified<AuditEventDetail>;

export interface AuditFilter {
  event: string | undefined;
  entityType: string | undefined;
  entityId: string | undefined;
  actorId: string | undefined;
  origin: string | undefined;
  from: string | undefined;
  to: string | undefined;
}

export interface AuditListQuery extends AuditFilter {
  page: number;
  limit: number;
  search: string;
  sortDir: 'asc' | 'desc';
}

export const fetchAuditEvents = (
  query: AuditListQuery,
  signal?: AbortSignal,
): Promise<Paginated<AuditEventRow>> =>
  apiRequest('GET', '/audit-events', { query: { ...query }, signal });

export const fetchAuditEvent = (
  id: string,
  signal?: AbortSignal,
): Promise<AuditEventFull> =>
  apiRequest('GET', `/audit-events/${id}`, { signal });

/** Downloads the CSV for the same filters as the list; the export itself is recorded. */
export const exportAuditEvents = (filter: AuditFilter): Promise<string> =>
  downloadFile('/audit-events/export', { ...filter }, 'nhat-ky-kiem-toan.csv');
