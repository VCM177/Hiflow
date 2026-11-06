import type { Paginated, PublicJobView } from '@hiflow/shared-types';
import type { Jsonified } from '@hiflow/shared-types';

import { apiProxyConfigFromEnv } from './api-proxy';

export type PublicJob = Jsonified<PublicJobView>;

export interface PublicJobsQuery {
  search?: string;
  sortBy?: 'publishedAt' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Reads the public job board while a page is rendered. The API limits these reads per
 * address, and from here the address it sees is this server's, so the visitor's own
 * `X-Forwarded-For` (set by the platform in front of the app) is passed on; without it
 * every visitor would share one allowance. Nothing is cached, so a job that was just
 * closed is gone from the next page view.
 */
async function getJson<T>(
  path: string,
  forwardedFor: string | null,
): Promise<T | null> {
  const config = apiProxyConfigFromEnv();
  if (!config) throw new Error('API_ORIGIN is not set');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.proxySecret) headers['x-hiflow-proxy-secret'] = config.proxySecret;
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const response = await fetch(
    `${config.apiOrigin.replace(/\/+$/, '')}${path}`,
    {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public API answered ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchPublicJobs(
  query: PublicJobsQuery,
  forwardedFor: string | null,
): Promise<Paginated<PublicJob>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  const page = await getJson<Paginated<PublicJob>>(
    `/public/jobs${text ? `?${text}` : ''}`,
    forwardedFor,
  );
  if (!page) throw new Error('Public job list not found');
  return page;
}

/** The job, or null when it does not exist or is no longer taking applications. */
export function fetchPublicJob(
  id: string,
  forwardedFor: string | null,
): Promise<PublicJob | null> {
  return getJson<PublicJob>(`/public/jobs/${id}`, forwardedFor);
}
