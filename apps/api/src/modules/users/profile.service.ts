import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../common/security/password';
import { User } from './entities/user.entity';
import { toUserView, UserView } from './user-view';
import { ChangePasswordDto } from './users.dto';

/** Self-service actions: every signed-in user may do these to their own account. */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
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

  async updateName(userId: string, fullName: string): Promise<UserView> {
    await this.users.update(userId, { fullName });
    return this.get(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
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

    await this.users.update(userId, {
      passwordHash: await hashPassword(dto.newPassword),
    });
  }
}
