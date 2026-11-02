import type { AuditDataArgs, AuditEvent } from '@hiflow/shared-types';
import { Injectable } from '@nestjs/common';
import type { AuditActor } from './audit.types';
import { TxRunner } from './tx-runner.service';

@Injectable()
export class AuditService {
  constructor(private readonly tx: TxRunner) {}

  /** For an event with no write of its own to ride along with: a login, a download, an export. */
  recordStandalone<E extends AuditEvent>(
    actor: AuditActor | null,
    event: E,
    entityId: string | null,
    ...data: AuditDataArgs<E>
  ): Promise<void> {
    return this.tx.run(actor, (_manager, audit) =>
      audit.record(event, entityId, ...data),
    );
  }
}
