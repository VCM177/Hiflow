import type {
  Jsonified,
  Paginated,
  RequisitionEvent,
  RequisitionStatus,
  RequisitionView,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Requisition = Jsonified<RequisitionView>;
export type RequisitionHistoryItem = Jsonified<RequisitionEvent>;

export interface RequisitionListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  status: RequisitionStatus | undefined;
  departmentId: string | undefined;
  createdFrom: string | undefined;
  createdTo: string | undefined;
}

export const fetchRequisitions = (
  query: Partial<RequisitionListQuery>,
  signal?: AbortSignal,
): Promise<Paginated<Requisition>> =>
  apiRequest('GET', '/requisitions', { query: { ...query }, signal });

export const fetchRequisition = (
  id: string,
  signal?: AbortSignal,
): Promise<Requisition> => apiRequest('GET', `/requisitions/${id}`, { signal });

export const fetchRequisitionHistory = (
  id: string,
  signal?: AbortSignal,
): Promise<RequisitionHistoryItem[]> =>
  apiRequest('GET', `/requisitions/${id}/history`, { signal });

export interface RequisitionBody {
  title: string;
  positionId: string;
  quantity: number;
  reason?: string | null;
  expectedStartDate?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
}

export const createRequisition = (
  body: RequisitionBody & { departmentId?: string },
): Promise<Requisition> => apiRequest('POST', '/requisitions', { body });

export const updateRequisition = (
  id: string,
  body: RequisitionBody,
): Promise<Requisition> => apiRequest('PATCH', `/requisitions/${id}`, { body });

export const deleteRequisition = (id: string): Promise<void> =>
  apiRequest('DELETE', `/requisitions/${id}`);

export const submitRequisition = (id: string): Promise<Requisition> =>
  apiRequest('POST', `/requisitions/${id}/submit`);

export const approveRequisition = (id: string): Promise<Requisition> =>
  apiRequest('POST', `/requisitions/${id}/approve`);

export const rejectRequisition = (
  id: string,
  reason: string,
): Promise<Requisition> =>
  apiRequest('POST', `/requisitions/${id}/reject`, { body: { reason } });

export const closeRequisition = (id: string): Promise<Requisition> =>
  apiRequest('POST', `/requisitions/${id}/close`);
