import type {
  CandidateApplicationSummary,
  CandidateDetailView,
  CandidateSource,
  CandidateView,
  Jsonified,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Candidate = Jsonified<CandidateView>;
export type CandidateDetail = Jsonified<CandidateDetailView>;
export type CandidateApplication = Jsonified<CandidateApplicationSummary>;

export interface CandidateListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  source: CandidateSource | undefined;
  createdFrom: string | undefined;
  createdTo: string | undefined;
}

export const fetchCandidates = (
  query: Partial<CandidateListQuery>,
  signal?: AbortSignal,
): Promise<Paginated<Candidate>> =>
  apiRequest('GET', '/candidates', { query: { ...query }, signal });

export const fetchCandidate = (
  id: string,
  signal?: AbortSignal,
): Promise<CandidateDetail> =>
  apiRequest('GET', `/candidates/${id}`, { signal });

export interface CandidateBody {
  fullName: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  source: CandidateSource;
}

export const createCandidate = (
  body: CandidateBody & { note?: string },
): Promise<Candidate> => apiRequest('POST', '/candidates', { body });

export const updateCandidate = (
  id: string,
  body: CandidateBody,
): Promise<Candidate> => apiRequest('PATCH', `/candidates/${id}`, { body });

export const setCandidateNote = (
  id: string,
  note: string,
): Promise<Candidate> =>
  apiRequest('PUT', `/candidates/${id}/note`, { body: { note } });

export function uploadCandidateCv(id: string, file: File): Promise<Candidate> {
  const body = new FormData();
  body.set('file', file);
  return apiRequest('POST', `/candidates/${id}/cv`, { body });
}

export const removeCandidateCv = (id: string): Promise<Candidate> =>
  apiRequest('DELETE', `/candidates/${id}/cv`);

export const anonymizeCandidate = (id: string): Promise<CandidateDetail> =>
  apiRequest('POST', `/candidates/${id}/anonymize`);

/** Where the browser opens a candidate's CV; the API checks permission and scope. */
export const candidateCvUrl = (id: string): string =>
  `/api/candidates/${id}/cv`;
