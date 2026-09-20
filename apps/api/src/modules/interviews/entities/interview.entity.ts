import { InterviewResult } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Application } from '../../applications/entities/application.entity';
import { User } from '../../users/entities/user.entity';

@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  @Column({ type: 'int', default: 1 })
  round!: number;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'uuid' })
  interviewerId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'interviewer_id' })
  interviewer?: User;

  @Column({
    type: 'enum',
    enum: InterviewResult,
    enumName: 'interview_result',
    default: InterviewResult.PENDING,
  })
  result!: InterviewResult;

  @Column({ type: 'text', nullable: true })
  feedback!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
