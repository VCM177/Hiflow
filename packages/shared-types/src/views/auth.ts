import type { GrantedPermission } from '../permissions';
import type { UserRole } from '../roles';

/** The signed-in user, as `GET /auth/me` and the login response return them. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  permissions: readonly GrantedPermission[];
}
