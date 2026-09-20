import { UserRole } from '@hiflow/shared-types';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const PASSWORD = 'Correct-Horse-1';
  let service: AuthService;
  let getOne: jest.Mock;
  const signAsync = jest.fn();

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'recruiter@hiflow.local',
      fullName: 'Recruiter One',
      role: UserRole.RECRUITER,
      isActive: true,
      passwordHash: bcrypt.hashSync(PASSWORD, 4),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    getOne = jest.fn();
    signAsync.mockReset().mockResolvedValue('signed.jwt.token');

    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: { createQueryBuilder: () => queryBuilder },
        },
        { provide: JwtService, useValue: { signAsync } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('returns a token and the user with role-derived permissions', async () => {
    getOne.mockResolvedValue(buildUser());

    const result = await service.login({
      email: 'recruiter@hiflow.local',
      password: PASSWORD,
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.role).toBe(UserRole.RECRUITER);
    expect(result.user.permissions).toContain('candidate.item.create');
    expect(result.user.permissions).not.toContain(
      'requisition.request.approve',
    );
  });

  it('signs a payload that carries subject, role and permissions', async () => {
    getOne.mockResolvedValue(buildUser({ role: UserRole.ADMIN }));

    await service.login({ email: 'a@hiflow.local', password: PASSWORD });

    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        role: UserRole.ADMIN,
        permissions: ['*'],
      }),
    );
  });

  it('rejects an unknown email', async () => {
    getOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@hiflow.local', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same error as an unknown email', async () => {
    getOne.mockResolvedValue(buildUser());

    const wrongPassword = service.login({
      email: 'recruiter@hiflow.local',
      password: 'not-the-password',
    });
    getOne.mockResolvedValue(null);
    const unknownEmail = service.login({
      email: 'nobody@hiflow.local',
      password: 'not-the-password',
    });

    await expect(wrongPassword).rejects.toThrow(
      'Email hoặc mật khẩu không đúng',
    );
    await expect(unknownEmail).rejects.toThrow(
      'Email hoặc mật khẩu không đúng',
    );
  });

  it('reports a locked account only after the password is proven', async () => {
    getOne.mockResolvedValue(buildUser({ isActive: false }));

    await expect(
      service.login({ email: 'recruiter@hiflow.local', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal a locked account when the password is wrong', async () => {
    getOne.mockResolvedValue(buildUser({ isActive: false }));

    await expect(
      service.login({
        email: 'recruiter@hiflow.local',
        password: 'not-the-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
