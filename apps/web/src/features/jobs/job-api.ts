import type {
  ApplicationListItem,
  Jsonified,
  JobStatus,
  JobView,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Job = Jsonified<JobView>;
export type JobApplication = Jsonified<ApplicationListItem>;

export interface JobListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  status: JobStatus | undefined;
  departmentId: string | undefined;
  positionId: string | undefined;
  requisitionId: string | undefined;
  createdFrom: string | undefined;
  createdTo: string | undefined;
}

export const fetchJobs = (
  query: Partial<JobListQuery>,
  signal?: AbortSignal,
): Promise<Paginated<Job>> =>
  apiRequest('GET', '/jobs', { query: { ...query }, signal });

export const fetchJob = (id: string, signal?: AbortSignal): Promise<Job> =>
  apiRequest('GET', `/jobs/${id}`, { signal });

export const fetchJobApplications = (
  jobId: string,
  query: { page: number; limit: number },
  signal?: AbortSignal,
): Promise<Paginated<JobApplication>> =>
  apiRequest('GET', '/applications', { query: { jobId, ...query }, signal });

export interface JobBody {
  title: string;
  quantity: number;
  salaryMin?: number | null;
  salaryMax?: number | null;
  location?: string | null;
  description?: string | null;
}

export const createJob = (
  body: JobBody & { requisitionId: string },
): Promise<Job> => apiRequest('POST', '/jobs', { body });

export const updateJob = (id: string, body: JobBody): Promise<Job> =>
  apiRequest('PATCH', `/jobs/${id}`, { body });

export const publishJob = (id: string): Promise<Job> =>
  apiRequest('POST', `/jobs/${id}/publish`);

export const stopJob = (id: string): Promise<Job> =>
  apiRequest('POST', `/jobs/${id}/stop`);

export const deleteJob = (id: string): Promise<void> =>
  apiRequest('DELETE', `/jobs/${id}`);
