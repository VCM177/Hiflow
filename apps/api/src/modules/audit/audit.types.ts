import type { AuditDataArgs, AuditEvent } from '@hiflow/shared-types';
import type { EntityManager } from 'typeorm';
import type { AuthUser } from '../../common/types/auth-user';

/** Who acted, as they were at that moment: the name and role are copied. */
export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export const actorOf = (user: AuthUser): AuditActor => ({
  id: user.id,
  name: user.fullName,
  role: user.role,
});

export interface AuditRecorder {
  /** `data` is required exactly when the event declares some in the catalogue. */
  record<E extends AuditEvent>(
    event: E,
    entityId: string | null,
    ...data: AuditDataArgs<E>
  ): Promise<void>;
}

export type TxWork<T> = (
  manager: EntityManager,
  audit: AuditRecorder,
) => Promise<T>;
