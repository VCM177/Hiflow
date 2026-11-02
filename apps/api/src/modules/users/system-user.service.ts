import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuditActor } from '../audit/audit.types';
import { User } from './entities/user.entity';

/** Finds the built-in system account (see `User.isSystem`). */
@Injectable()
export class SystemUserService {
  private cached: AuditActor | undefined;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Throws if the migration that creates the account has not been run. */
  async id(): Promise<string> {
    return (await this.actor()).id;
  }

  /** The system account as the audit trail names it when a visitor, not a person, acts. */
  async actor(): Promise<AuditActor> {
    if (!this.cached) {
      const account = await this.users.findOneOrFail({
        where: { isSystem: true },
        select: { id: true, fullName: true, role: true },
      });
      this.cached = {
        id: account.id,
        name: account.fullName,
        role: account.role,
      };
    }

    return this.cached;
  }
}
