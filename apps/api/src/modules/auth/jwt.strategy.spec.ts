import { UserRole } from '@hiflow/shared-types';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { JwtPayload } from '../../common/types/auth-user';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const findOne = jest.fn();
  const strategy = new JwtStrategy(
    { getOrThrow: () => 'test-secret' } as unknown as ConfigService,
    { findOne } as unknown as Repository<User>,
  );

  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'old@hiflow.local',
    role: UserRole.ADMIN,
    permissions: ['*'],
  };

  beforeEach(() => findOne.mockReset());

  it('derives role and permissions from the database, not the token', async () => {
    findOne.mockResolvedValue({
      id: 'user-1',
      email: 'new@hiflow.local',
      fullName: 'Demoted',
      role: UserRole.INTERVIEWER,
      isActive: true,
    });

    const user = await strategy.validate(payload);

    expect(user.role).toBe(UserRole.INTERVIEWER);
    expect(user.permissions).not.toContain('*');
    expect(user.email).toBe('new@hiflow.local');
  });

  it('rejects a user who has been locked since the token was issued', async () => {
    findOne.mockResolvedValue({ id: 'user-1', isActive: false });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose user no longer exists', async () => {
    findOne.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
