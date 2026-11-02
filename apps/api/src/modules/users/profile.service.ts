import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../common/security/password';
import type { AuthUser } from '../../common/types/auth-user';
import { actorOf } from '../audit/audit.types';
import { TxRunner } from '../audit/tx-runner.service';
import { User } from './entities/user.entity';
import { toUserView, UserView } from './user-view';
import { ChangePasswordDto } from './users.dto';

/** Self-service actions: every signed-in user may do these to their own account. */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tx: TxRunner,
  ) {}

  async get(userId: string): Promise<UserView> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { department: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return toUserView(user);
  }

  async updateName(actor: AuthUser, fullName: string): Promise<UserView> {
    if (actor.fullName !== fullName) {
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        await manager.getRepository(User).update(actor.id, { fullName });
        await audit.record('PROFILE_UPDATED', actor.id, {
          changedFields: ['fullName'],
        });
      });
    }
    return this.get(actor.id);
  }

  async changePassword(actor: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const userId = actor.id;
    const user = await this.users
      .createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.tx.run(actorOf(actor), async (manager, audit) => {
      await manager.getRepository(User).update(userId, { passwordHash });
      await audit.record('PASSWORD_CHANGED', userId);
    });
  }
}
