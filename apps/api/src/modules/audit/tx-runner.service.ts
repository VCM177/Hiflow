import { AUDIT_EVENTS } from '@hiflow/shared-types';
import type { AuditDataArgs, AuditEvent } from '@hiflow/shared-types';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { requestContext } from '../../common/request-context/request-context';
import type { AuditActor, AuditRecorder, TxWork } from './audit.types';

/**
 * The only way to write business data: one transaction that carries the audit
 * context to the database triggers and into which the service records its
 * events, so the data, its row-level trail and its events commit or roll back
 * together.
 */
@Injectable()
export class TxRunner {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(actor: AuditActor | null, work: TxWork<T>): Promise<T> {
    const txId = randomUUID();
    const context = requestContext.get();
    const origin = process.env.AUDIT_ORIGIN ?? 'app';

    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('hiflow.tx_id', $1, true),
                set_config('hiflow.actor_id', $2, true),
                set_config('hiflow.request_id', $3, true),
                set_config('hiflow.origin', $4, true)`,
        [txId, actor?.id ?? '', context?.requestId ?? '', origin],
      );

      return work(manager, this.recorder(manager, { txId, actor, origin }));
    });
  }

  private recorder(
    manager: EntityManager,
    tx: { txId: string; actor: AuditActor | null; origin: string },
  ): AuditRecorder {
    return {
      record: async <E extends AuditEvent>(
        event: E,
        entityId: string | null,
        ...data: AuditDataArgs<E>
      ): Promise<void> => {
        const context = requestContext.get();

        await manager.query(
          `INSERT INTO audit_events
             (event, entity_type, entity_id, actor_id, actor_name, actor_role,
              tx_id, request_id, origin, ip, user_agent, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
          [
            event,
            AUDIT_EVENTS[event].entityType,
            entityId,
            tx.actor?.id ?? null,
            tx.actor?.name ?? null,
            tx.actor?.role ?? null,
            tx.txId,
            context?.requestId ?? null,
            tx.origin,
            context?.ip ?? null,
            context?.userAgent ?? null,
            JSON.stringify(data[0] ?? {}),
          ],
        );
        context?.recorded.add(event);
      },
    };
  }
}
