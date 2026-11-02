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
import { AuditService } from '../audit/audit.service';
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
    private readonly audit: AuditService,
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

    // Both failures write one event, so they still cost the same. The email
    // that was typed is never stored: it may belong to a stranger.
    if (!user || !passwordMatches) {
      await this.audit.recordStandalone(
        null,
        'AUTH_LOGIN_FAILED',
        user?.id ?? null,
        { reason: 'INVALID_CREDENTIALS' },
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Only reveal the lock after the password is proven, so the message does
    // not confirm to a stranger that an email is registered.
    if (!user.isActive) {
      await this.audit.recordStandalone(null, 'AUTH_LOGIN_FAILED', user.id, {
        reason: 'ACCOUNT_LOCKED',
      });
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }

    const permissions = permissionsForRole(user.role);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    await this.audit.recordStandalone(
      { id: user.id, name: user.fullName, role: user.role },
      'AUTH_LOGIN_SUCCEEDED',
      user.id,
    );

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        permissions,
      },
    };
  }

  /**
   * Logging out is public so it works with an expired token, which means the
   * caller is only known when the token still verifies; otherwise nothing is
   * recorded rather than guessing who it was.
   */
  async logout(token: string | null): Promise<void> {
    if (!token) return;

    let userId: string;
    try {
      userId = (await this.jwt.verifyAsync<JwtPayload>(token)).sub;
    } catch {
      return;
    }

    const user = await this.users.findOneBy({ id: userId });
    if (!user) return;

    await this.audit.recordStandalone(
      { id: user.id, name: user.fullName, role: user.role },
      'AUTH_LOGGED_OUT',
      user.id,
    );
  }

  /** How long the session cookie should live: as long as the token it carries. */
  sessionMaxAgeMs(token: string): number | undefined {
    const exp = this.jwt.decode<{ exp?: number } | null>(token)?.exp;

    return typeof exp === 'number'
      ? Math.max(0, exp * 1000 - Date.now())
      : undefined;
  }
}
