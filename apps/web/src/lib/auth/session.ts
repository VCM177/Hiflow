import type { AuthUser } from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';

/** Cache key of the signed-in user (`GET /auth/me`). */
export const sessionQueryKey = queryKeys.detail('session', 'me');

/** The signed-in user and their permissions. Rejects with a 401 ApiError when signed out. */
export function fetchSession(signal?: AbortSignal): Promise<AuthUser> {
  return apiRequest<AuthUser>('GET', '/auth/me', { signal });
}

/**
 * Ends the session. The API clears the cookie; the token is not in the response
 * (the web proxy removes it), so there is nothing to forget here.
 */
export function endSession(): Promise<void> {
  return apiRequest<void>('POST', '/auth/logout');
}
