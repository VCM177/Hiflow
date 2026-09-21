import { ApplicationStatus } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Candidate } from '../../candidates/entities/candidate.entity';
import { Job } from '../../jobs/entities/job.entity';
import { User } from '../../users/entities/user.entity';

@Entity('applications')
@Unique(['candidateId', 'jobId'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => Candidate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'candidate_id' })
  candidate?: Candidate;

  @Column({ type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status',
    default: ApplicationStatus.NEW,
  })
  status!: ApplicationStatus;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  appliedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee?: User | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /**
   * The CV sent with this application (storage key, never a URL). It lives here
   * rather than on the candidate so a later submission by someone using the same
   * email can never replace the CV of an earlier one.
   */
  @Column({ type: 'varchar', nullable: true })
  cvFileKey!: string | null;

  /**
   * When the applicant agreed to their personal data being processed for this
   * application (the consent line on the public form). Null for applications
   * staff entered on someone's behalf.
   */
  @Column({ type: 'timestamptz', nullable: true })
  consentAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
