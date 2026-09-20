import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('returns the config when every required variable is present', () => {
    const config = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' };

    expect(validateEnv(config)).toBe(config);
  });

  it('names every missing variable in the error', () => {
    expect(() => validateEnv({})).toThrow(
      'Missing required environment variables: DATABASE_URL, JWT_SECRET',
    );
  });

  it('needs Redis, the proxy depth and the proxy secret in production, but not elsewhere', () => {
    const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' };

    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      'REDIS_URL, TRUST_PROXY, PROXY_SECRET',
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        REDIS_URL: 'rediss://x',
        TRUST_PROXY: '2',
        PROXY_SECRET: 'x',
      }),
    ).not.toThrow();
  });

  it('treats an empty string as missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: '' }),
    ).toThrow('JWT_SECRET');
  });
});
