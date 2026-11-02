import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One business action, written by a service inside the same transaction. */
@Entity('audit_events')
@Index('idx_audit_events_occurred', ['occurredAt'])
@Index('idx_audit_events_entity', ['entityType', 'entityId', 'occurredAt'])
@Index('idx_audit_events_actor', ['actorId', 'occurredAt'])
@Index('idx_audit_events_tx', ['txId'])
@Index('idx_audit_events_event', ['event', 'occurredAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'timestamptz',
    default: () => 'clock_timestamp()',
  })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  event!: string;

  @Column({ type: 'varchar', length: 32 })
  entityType!: string;

  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  /** No foreign key: deleting a user must never touch the log. */
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  /** The actor as they were when they acted. */
  @Column({ type: 'varchar', nullable: true })
  actorName!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actorRole!: string | null;

  @Column({ type: 'uuid' })
  txId!: string;

  @Column({ type: 'uuid', nullable: true })
  requestId!: string | null;

  /** `app`, `seed`, `maintenance` or `e2e`. */
  @Column({ type: 'varchar', length: 16 })
  origin!: string;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data!: Record<string, unknown>;
}
