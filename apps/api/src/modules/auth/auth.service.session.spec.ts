import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService.sessionMaxAgeMs', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AuthService({} as Repository<User>, jwt);

  it('lasts as long as the token has left', () => {
    const token = jwt.sign({ sub: 'u1' }, { expiresIn: '1h' });

    const ms = service.sessionMaxAgeMs(token) as number;

    expect(ms).toBeGreaterThan(59 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('is zero for a token that has already expired', () => {
    const token = jwt.sign(
      { sub: 'u1', exp: Math.floor(Date.now() / 1000) - 10 },
      { noTimestamp: true },
    );

    expect(service.sessionMaxAgeMs(token)).toBe(0);
  });

  it('is undefined for a token with no expiry, so the cookie ends with the browser session', () => {
    const token = jwt.sign({ sub: 'u1' });

    expect(service.sessionMaxAgeMs(token)).toBeUndefined();
  });

  it('is undefined for something that is not a token', () => {
    expect(service.sessionMaxAgeMs('not-a-jwt')).toBeUndefined();
  });
});
