import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

/** Finds the built-in system account (see `User.isSystem`). */
@Injectable()
export class SystemUserService {
  private cachedId: string | undefined;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Throws if the migration that creates the account has not been run. */
  async id(): Promise<string> {
    if (!this.cachedId) {
      const account = await this.users.findOneOrFail({
        where: { isSystem: true },
        select: { id: true },
      });
      this.cachedId = account.id;
    }

    return this.cachedId;
  }
}
