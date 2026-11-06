import {
  USER_ROLE_LABEL,
  UserRole,
  type Permission,
  PERMISSIONS,
} from '@hiflow/shared-types';

import type { StatusMap } from '@/components/shared/status-badge';
import type { SelectOption } from '@/components/shared/form/rhf-select-field';

/** The columns the API lets the user list sort by (`ListUsersQueryDto.sortBy`). */
export const USER_SORT_KEYS = [
  'fullName',
  'email',
  'role',
  'createdAt',
] as const;

export type AccountState = 'active' | 'locked';

export const ACCOUNT_STATE_MAP: StatusMap<AccountState> = {
  active: { label: 'Hoạt động', variant: 'success' },
  locked: { label: 'Đã khóa', variant: 'neutral' },
};

export const ROLE_OPTIONS: readonly SelectOption[] = Object.values(
  UserRole,
).map((role) => ({ value: role, label: USER_ROLE_LABEL[role] }));

/** Roles `actorRole` may hand out: only an Admin grants Admin. */
export function grantableRoleOptions(
  actorRole: UserRole,
): readonly SelectOption[] {
  return actorRole === UserRole.ADMIN
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value !== UserRole.ADMIN);
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    (Object.values(UserRole) as string[]).includes(value)
  );
}

/** The select value that means "no department" (a Radix item cannot have an empty value). */
export const NO_DEPARTMENT = 'none';

export const USER_ACTION_PERMISSIONS: Record<
  'create' | 'update' | 'role' | 'status' | 'password',
  Permission
> = {
  create: PERMISSIONS.user.create,
  update: PERMISSIONS.user.update,
  role: PERMISSIONS.user.roleAssign,
  status: PERMISSIONS.user.statusUpdate,
  password: PERMISSIONS.user.passwordReset,
};
