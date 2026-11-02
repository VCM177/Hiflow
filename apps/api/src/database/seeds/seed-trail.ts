import { AUDIT_EVENTS } from '@hiflow/shared-types';
import type { AuditDataArgs, AuditEvent } from '@hiflow/shared-types';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';

export interface SeedActor {
  id: string;
  name: string;
  role: string;
}

/**
 * Tells the audit triggers that this transaction is a seed run by the system
 * account, so what it writes is tagged `seed` and not mistaken for a person's
 * work or for a hand edit. Returns the transaction id the events share.
 */
export async function beginSeedContext(
  manager: EntityManager,
): Promise<string> {
  const txId = randomUUID();
  const system: { id: string }[] = await manager.query(
    `SELECT id FROM users WHERE is_system = true`,
  );

  await manager.query(
    `SELECT set_config('hiflow.tx_id', $1, true),
            set_config('hiflow.actor_id', $2, true),
            set_config('hiflow.origin', 'seed', true)`,
    [txId, system[0]?.id ?? ''],
  );

  return txId;
}

/** The seeded people as the trail names them, by email. */
export async function seedActors(
  manager: EntityManager,
): Promise<Map<string, SeedActor>> {
  const rows: { id: string; email: string; full_name: string; role: string }[] =
    await manager.query(`SELECT id, email, full_name, role FROM users`);

  return new Map(
    rows.map((row) => [
      row.email,
      { id: row.id, name: row.full_name, role: row.role },
    ]),
  );
}

/** Writes the events a real run of the demo would have left, dated as they would be. */
export class SeedTrail {
  constructor(
    private readonly manager: EntityManager,
    private readonly txId: string,
  ) {}

  async record<E extends AuditEvent>(
    event: E,
    entityId: string,
    actor: SeedActor,
    at: Date,
    ...data: AuditDataArgs<E>
  ): Promise<void> {
    await this.manager.query(
      `INSERT INTO audit_events
         (occurred_at, event, entity_type, entity_id, actor_id, actor_name,
          actor_role, tx_id, origin, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'seed', $9::jsonb)`,
      [
        at,
        event,
        AUDIT_EVENTS[event].entityType,
        entityId,
        actor.id,
        actor.name,
        actor.role,
        this.txId,
        JSON.stringify(data[0] ?? {}),
      ],
    );
  }
}
