import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';

const FIVE_MINUTES = 5 * 60 * 1000;
const MAX_RETRIES = 1;

/**
 * Retries only failures that may pass on their own: network errors (status 0) and
 * server errors (5xx). A client error (4xx) would fail again the same way, so it is
 * never retried. A 401 already redirects to login inside the API client.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FIVE_MINUTES,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // A write is never repeated automatically: it could create a duplicate.
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One QueryClient per browser tab. On the server each call gets a fresh client so
 * one request's cache never leaks into another's.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
