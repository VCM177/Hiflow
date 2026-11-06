import type {
  InterviewResult,
  InterviewView,
  Jsonified,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Interview = Jsonified<InterviewView>;

export const scheduleInterview = (body: {
  applicationId: string;
  interviewerId: string;
  scheduledAt: string;
  round?: number;
}): Promise<Interview> => apiRequest('POST', '/interviews', { body });

export interface InterviewListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  result: InterviewResult | undefined;
  applicationId: string | undefined;
  interviewerId: string | undefined;
  round: number | undefined;
  scheduledFrom: string | undefined;
  scheduledTo: string | undefined;
}

export const fetchInterviews = (
  query: Partial<InterviewListQuery>,
  signal?: AbortSignal,
): Promise<Paginated<Interview>> =>
  apiRequest('GET', '/interviews', { query: { ...query }, signal });

export const fetchInterview = (
  id: string,
  signal?: AbortSignal,
): Promise<Interview> => apiRequest('GET', `/interviews/${id}`, { signal });

export const updateInterview = (
  id: string,
  body: { interviewerId?: string; scheduledAt?: string; round?: number },
): Promise<Interview> => apiRequest('PATCH', `/interviews/${id}`, { body });

export const cancelInterview = (id: string): Promise<Interview> =>
  apiRequest('POST', `/interviews/${id}/cancel`);

export const recordInterviewResult = (
  id: string,
  body: { result: 'PASSED' | 'FAILED'; feedback?: string },
): Promise<Interview> =>
  apiRequest('POST', `/interviews/${id}/result`, { body });
