import type {
  AuthUser,
  GrantedPermission,
  UserRole,
} from '@hiflow/shared-types';

// The shape lives in shared-types so the web app reads the same one from GET /auth/me.
export type { AuthUser };

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Included for the web client to hide UI; the server re-derives from role. */
  permissions: readonly GrantedPermission[];
}
