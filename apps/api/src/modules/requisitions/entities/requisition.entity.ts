import { RequisitionStatus } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Department } from '../../departments/entities/department.entity';
import { JobPosition } from '../../positions/entities/job-position.entity';
import { User } from '../../users/entities/user.entity';

@Entity('requisitions')
export class Requisition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  title!: string;

  @Column({ type: 'uuid' })
  departmentId!: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'uuid' })
  positionId!: string;

  @ManyToOne(() => JobPosition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position?: JobPosition;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'date', nullable: true })
  expectedStartDate!: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  budgetMin!: number | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  budgetMax!: number | null;

  @Column({
    type: 'enum',
    enum: RequisitionStatus,
    enumName: 'requisition_status',
    default: RequisitionStatus.DRAFT,
  })
  status!: RequisitionStatus;

  @Column({ type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @Column({ type: 'uuid', nullable: true })
  approvedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
