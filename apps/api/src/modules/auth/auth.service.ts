import { permissionsForRole } from '@hiflow/shared-types';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuthUser, JwtPayload } from '../../common/types/auth-user';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

// Compared against when the email is unknown so both failure paths cost the
// same time and cannot be told apart by response latency.
const DUMMY_HASH = bcrypt.hashSync('hiflow-timing-equaliser', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Only reveal the lock after the password is proven, so the message does
    // not confirm to a stranger that an email is registered.
    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }

    const permissions = permissionsForRole(user.role);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions,
      },
    };
  }
}
