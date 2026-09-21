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
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
      }),
    ).not.toThrow();
  });

  describe('file storage', () => {
    const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' };

    it('defaults to local disk and accepts it outside production', () => {
      expect(() => validateEnv(base)).not.toThrow();
      expect(() =>
        validateEnv({ ...base, STORAGE_DRIVER: 'local' }),
      ).not.toThrow();
    });

    it('needs the Supabase address and key when Supabase is chosen', () => {
      expect(() =>
        validateEnv({ ...base, STORAGE_DRIVER: 'supabase' }),
      ).toThrow('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    });

    it('rejects an unknown driver', () => {
      expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(
        'STORAGE_DRIVER must be',
      );
    });

    it('refuses local disk in production, where files would vanish on restart', () => {
      expect(() =>
        validateEnv({
          ...base,
          NODE_ENV: 'production',
          REDIS_URL: 'rediss://x',
          TRUST_PROXY: '2',
          PROXY_SECRET: 'x',
          STORAGE_DRIVER: 'local',
        }),
      ).toThrow('Production needs STORAGE_DRIVER=supabase');
    });
  });

  it('treats an empty string as missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: '' }),
    ).toThrow('JWT_SECRET');
  });
});
