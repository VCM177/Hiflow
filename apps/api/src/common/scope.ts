import { UserRole } from '@hiflow/shared-types';
import type { AuthUser } from './types/auth-user';

/** A user with no department must match no rows rather than every row. */
export const NO_DEPARTMENT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * The department a query must be limited to, or `null` when the caller may see
 * every department. Only department managers are confined to their own.
 */
export function departmentScope(actor: AuthUser): string | null {
  return actor.role === UserRole.DEPT_MANAGER
    ? (actor.departmentId ?? NO_DEPARTMENT_ID)
    : null;
}
