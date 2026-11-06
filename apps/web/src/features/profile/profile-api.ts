import type { Jsonified, UserView } from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Profile = Jsonified<UserView>;

export const profileQueryKey = ['profile', 'detail', 'me'] as const;

export const fetchProfile = (signal?: AbortSignal): Promise<Profile> =>
  apiRequest('GET', '/profile', { signal });

export const updateProfileName = (fullName: string): Promise<Profile> =>
  apiRequest('PATCH', '/profile', { body: { fullName } });

export const changePassword = (body: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> => apiRequest('POST', '/profile/change-password', { body });
