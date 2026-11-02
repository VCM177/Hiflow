import { UserRole } from '@hiflow/shared-types';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const PASSWORD = 'Correct-Horse-1';
  let service: AuthService;
  let getOne: jest.Mock;
  const signAsync = jest.fn();
  const verifyAsync = jest.fn();
  const recordStandalone = jest.fn();
  const findOneBy = jest.fn();

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
    verifyAsync.mockReset();
    recordStandalone.mockReset().mockResolvedValue(undefined);
    findOneBy.mockReset();

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
          useValue: { createQueryBuilder: () => queryBuilder, findOneBy },
        },
        { provide: JwtService, useValue: { signAsync, verifyAsync } },
        { provide: AuditService, useValue: { recordStandalone } },
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

  describe('audit trail', () => {
    it('records a successful login for the person who logged in', async () => {
      getOne.mockResolvedValue(buildUser());

      await service.login({
        email: 'recruiter@hiflow.local',
        password: PASSWORD,
      });

      expect(recordStandalone).toHaveBeenCalledWith(
        { id: 'user-1', name: 'Recruiter One', role: UserRole.RECRUITER },
        'AUTH_LOGIN_SUCCEEDED',
        'user-1',
      );
    });

    it('records a wrong password against the account, without an actor', async () => {
      getOne.mockResolvedValue(buildUser());

      await expect(
        service.login({ email: 'recruiter@hiflow.local', password: 'nope' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(recordStandalone).toHaveBeenCalledWith(
        null,
        'AUTH_LOGIN_FAILED',
        'user-1',
        { reason: 'INVALID_CREDENTIALS' },
      );
    });

    it('records an unknown email too, but never keeps what was typed', async () => {
      getOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'stranger@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(recordStandalone).toHaveBeenCalledTimes(1);
      expect(recordStandalone).toHaveBeenCalledWith(
        null,
        'AUTH_LOGIN_FAILED',
        null,
        { reason: 'INVALID_CREDENTIALS' },
      );
      expect(JSON.stringify(recordStandalone.mock.calls)).not.toContain(
        'stranger@example.com',
      );
    });

    it('records a locked account only once the password was right', async () => {
      getOne.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        service.login({
          email: 'recruiter@hiflow.local',
          password: PASSWORD,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(recordStandalone).toHaveBeenCalledWith(
        null,
        'AUTH_LOGIN_FAILED',
        'user-1',
        { reason: 'ACCOUNT_LOCKED' },
      );
    });
  });

  describe('logout', () => {
    it('records who logged out when the token still verifies', async () => {
      verifyAsync.mockResolvedValue({ sub: 'user-1' });
      findOneBy.mockResolvedValue(buildUser());

      await service.logout('good.token');

      expect(recordStandalone).toHaveBeenCalledWith(
        { id: 'user-1', name: 'Recruiter One', role: UserRole.RECRUITER },
        'AUTH_LOGGED_OUT',
        'user-1',
      );
    });

    it.each([
      ['no token', null, undefined],
      ['an expired or forged token', 'bad.token', new Error('expired')],
    ])(
      'records nothing for %s, and does not fail',
      async (_label, token, err) => {
        if (err) verifyAsync.mockRejectedValue(err);

        await expect(service.logout(token)).resolves.toBeUndefined();

        expect(recordStandalone).not.toHaveBeenCalled();
      },
    );

    it('records nothing when the account no longer exists', async () => {
      verifyAsync.mockResolvedValue({ sub: 'gone' });
      findOneBy.mockResolvedValue(null);

      await service.logout('good.token');

      expect(recordStandalone).not.toHaveBeenCalled();
    });
  });
});
