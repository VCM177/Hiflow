import { JobStatus } from '@hiflow/shared-types';
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
import { Requisition } from '../../requisitions/entities/requisition.entity';
import { User } from '../../users/entities/user.entity';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requisitionId!: string;

  @ManyToOne(() => Requisition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requisition_id' })
  requisition?: Requisition;

  @Column()
  title!: string;

  @Column({ type: 'uuid' })
  positionId!: string;

  @ManyToOne(() => JobPosition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position?: JobPosition;

  @Column({ type: 'uuid' })
  departmentId!: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  salaryMin!: number | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  salaryMax!: number | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: JobStatus,
    enumName: 'job_status',
    default: JobStatus.DRAFT,
  })
  status!: JobStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
