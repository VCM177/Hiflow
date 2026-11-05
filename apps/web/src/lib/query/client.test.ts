import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { getQueryClient, makeQueryClient, shouldRetry } from './client';

describe('shouldRetry', () => {
  it('never retries a client error, because it would fail the same way', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 429]) {
      expect(shouldRetry(0, new ApiError(status, []))).toBe(false);
    }
  });

  it('retries a network failure and a server error once', () => {
    expect(shouldRetry(0, new ApiError(0, []))).toBe(true);
    expect(shouldRetry(0, new ApiError(503, []))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, []))).toBe(false);
  });

  it('retries an unknown (non-API) error once', () => {
    expect(shouldRetry(0, new TypeError('boom'))).toBe(true);
    expect(shouldRetry(1, new TypeError('boom'))).toBe(false);
  });
});

describe('makeQueryClient', () => {
  it('keeps data fresh for five minutes, does not refetch on focus, and never retries a write', () => {
    const client = makeQueryClient();
    const queries = client.getDefaultOptions().queries;
    const mutations = client.getDefaultOptions().mutations;
    expect(queries?.staleTime).toBe(5 * 60 * 1000);
    expect(queries?.refetchOnWindowFocus).toBe(false);
    expect(mutations?.retry).toBe(false);
  });
});

describe('getQueryClient', () => {
  it('returns the same client for the same browser tab', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });
});
