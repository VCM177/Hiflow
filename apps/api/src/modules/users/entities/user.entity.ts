import { UserRole } from '@hiflow/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';

@Entity('users')
// At most one system account can exist.
@Index('UQ_users_single_system', ['isSystem'], {
  unique: true,
  where: '"is_system"',
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  /** Never selected by default; the login query opts in with addSelect. */
  @Column({ select: false })
  passwordHash!: string;

  @Column()
  fullName!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  @Column({ type: 'uuid', nullable: true })
  departmentId!: string | null;

  // RESTRICT, not SET NULL: deleting a department that still has members must
  // be refused rather than silently detaching everyone from it.
  @ManyToOne(() => Department, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * The one built-in account that authors changes no person made (a candidate
   * applying through the website). It is locked, has an unknowable password and
   * is invisible to every user-facing endpoint.
   */
  @Column({ default: false })
  isSystem!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
