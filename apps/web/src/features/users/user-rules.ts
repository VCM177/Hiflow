import { UserRole } from '@hiflow/shared-types';

export interface RowActor {
  id: string;
  role: UserRole;
}

export interface RowTarget {
  id: string;
  role: UserRole;
}

export interface RowRules {
  /** False when the row is an Admin account and the actor is not an Admin: show nothing. */
  manageable: boolean;
  /** Why changing the role is locked, or undefined when it is open. */
  roleLocked?: string;
  /** Why locking the account is locked, or undefined when it is open. */
  statusLocked?: string;
}

/**
 * What the screen offers on one row. The API enforces all of it (403); this keeps the
 * buttons honest: nobody changes their own role or locks themselves, and only an Admin
 * touches an Admin account.
 */
export function rowRules(
  actor: RowActor,
  target: RowTarget,
  targetIsActive: boolean,
): RowRules {
  const manageable =
    actor.role === UserRole.ADMIN || target.role !== UserRole.ADMIN;
  const self = actor.id === target.id;
  return {
    manageable,
    roleLocked: self ? 'Bạn không thể đổi vai trò của chính mình.' : undefined,
    statusLocked:
      self && targetIsActive
        ? 'Bạn không thể khóa tài khoản của chính mình.'
        : undefined,
  };
}
