import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** What a trigger saw change in a business table, linked to its event by `txId`. */
@Entity('audit_row_changes')
@Index('idx_audit_row_changes_row', ['tableName', 'rowId', 'id'])
@Index('idx_audit_row_changes_tx', ['txId'])
export class AuditRowChange {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id!: string;

  @Column({ type: 'uuid' })
  txId!: string;

  @Column({ type: 'varchar', length: 64 })
  tableName!: string;

  @Column({ type: 'uuid' })
  rowId!: string;

  /** `I`nsert, `U`pdate or `D`elete. */
  @Column({ type: 'char', length: 1 })
  op!: 'I' | 'U' | 'D';

  /** Insert: `{column: new}`. Update: `{column: [old, new]}`. Delete: `{column: old}`. */
  @Column({ type: 'jsonb' })
  changes!: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  requestId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  origin!: string;

  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  occurredAt!: Date;
}
