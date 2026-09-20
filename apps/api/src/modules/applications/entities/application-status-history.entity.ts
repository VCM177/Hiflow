import { ApplicationStatus } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Application } from './application.entity';

@Entity('application_status_histories')
@Index(['applicationId', 'changedAt'])
export class ApplicationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status',
    nullable: true,
  })
  fromStatus!: ApplicationStatus | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status',
  })
  toStatus!: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid' })
  changedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy?: User;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt!: Date;
}
