import type {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationStatus,
  Jsonified,
  OfferView,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type ApplicationItem = Jsonified<ApplicationListItem>;
export type ApplicationFull = Jsonified<ApplicationDetail>;
export type Offer = Jsonified<OfferView>;

export interface ApplicationListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  status: ApplicationStatus | undefined;
  jobId: string | undefined;
  candidateId: string | undefined;
  assigneeId: string | undefined;
  departmentId: string | undefined;
  appliedFrom: string | undefined;
  appliedTo: string | undefined;
}

export const fetchApplications = (
  query: Partial<ApplicationListQuery>,
  signal?: AbortSignal,
): Promise<Paginated<ApplicationItem>> =>
  apiRequest('GET', '/applications', { query: { ...query }, signal });

export const fetchApplication = (
  id: string,
  signal?: AbortSignal,
): Promise<ApplicationFull> =>
  apiRequest('GET', `/applications/${id}`, { signal });

export const createApplication = (body: {
  candidateId: string;
  jobId: string;
  assigneeId?: string;
  note?: string;
}): Promise<ApplicationFull> => apiRequest('POST', '/applications', { body });

export const changeApplicationStatus = (
  id: string,
  toStatus: ApplicationStatus,
  note?: string,
): Promise<ApplicationFull> =>
  apiRequest('POST', `/applications/${id}/status`, {
    body: { toStatus, ...(note ? { note } : {}) },
  });

/** `null` takes the application away from its assignee. */
export const changeApplicationAssignee = (
  id: string,
  assigneeId: string | null,
): Promise<ApplicationFull> =>
  apiRequest('PATCH', `/applications/${id}/assignee`, { body: { assigneeId } });

export const setApplicationNote = (
  id: string,
  note: string,
): Promise<ApplicationFull> =>
  apiRequest('PUT', `/applications/${id}/note`, { body: { note } });

export const applicationCvUrl = (id: string): string =>
  `/api/applications/${id}/cv`;

export interface OfferBody {
  salary: number;
  startDate: string;
  expiresAt?: string | null;
  note?: string | null;
}

export const createOffer = (id: string, body: OfferBody): Promise<Offer> =>
  apiRequest('POST', `/applications/${id}/offer`, { body });

export const updateOffer = (
  id: string,
  body: Partial<OfferBody>,
): Promise<Offer> => apiRequest('PATCH', `/applications/${id}/offer`, { body });

export const respondToOffer = (
  id: string,
  accepted: boolean,
  note?: string,
): Promise<Offer> =>
  apiRequest('POST', `/applications/${id}/offer/response`, {
    body: { accepted, ...(note ? { note } : {}) },
  });
