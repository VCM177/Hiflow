import { GrantedPermission, UserRole } from '@hiflow/shared-types';

/** The authenticated principal attached to `request.user` by the JWT guard. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  permissions: readonly GrantedPermission[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Included for the web client to hide UI; the server re-derives from role. */
  permissions: readonly GrantedPermission[];
}
