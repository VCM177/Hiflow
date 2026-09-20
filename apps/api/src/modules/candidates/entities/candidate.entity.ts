import { CandidateSource } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({
    type: 'enum',
    enum: CandidateSource,
    enumName: 'candidate_source',
    default: CandidateSource.OTHER,
  })
  source!: CandidateSource;

  @Column({ type: 'varchar', nullable: true })
  cvFileKey!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
