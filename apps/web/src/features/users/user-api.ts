import type {
  Jsonified,
  Paginated,
  UserRole,
  UserView,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type UserRow = Jsonified<UserView>;

export interface UserListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
  role: UserRole | undefined;
  departmentId: string | undefined;
  isActive: boolean | undefined;
}

export function fetchUsers(
  query: UserListQuery,
  signal?: AbortSignal,
): Promise<Paginated<UserRow>> {
  return apiRequest('GET', '/users', { query: { ...query }, signal });
}

export interface CreateUserBody {
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  password: string;
}

export const createUser = (body: CreateUserBody): Promise<UserRow> =>
  apiRequest('POST', '/users', { body });

/** `departmentId: null` takes the person out of their department. */
export const updateUser = (
  id: string,
  body: { fullName: string; departmentId: string | null },
): Promise<UserRow> => apiRequest('PATCH', `/users/${id}`, { body });

export const changeUserRole = (id: string, role: UserRole): Promise<UserRow> =>
  apiRequest('PATCH', `/users/${id}/role`, { body: { role } });

export const setUserActive = (
  id: string,
  isActive: boolean,
): Promise<UserRow> =>
  apiRequest('PATCH', `/users/${id}/status`, { body: { isActive } });

export const resetUserPassword = (
  id: string,
  newPassword: string,
): Promise<void> =>
  apiRequest('POST', `/users/${id}/reset-password`, { body: { newPassword } });
