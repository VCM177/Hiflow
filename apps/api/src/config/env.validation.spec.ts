import { validateEnv } from './env.validation';

const BASE = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' };

/** Everything production needs, so a test can take one piece away. */
const PRODUCTION = {
  ...BASE,
  NODE_ENV: 'production',
  REDIS_URL: 'rediss://x',
  TRUST_PROXY: '2',
  PROXY_SECRET: 'x',
  TURNSTILE_SECRET: 'x',
  STORAGE_DRIVER: 'supabase',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
  MAIL_DRIVER: 'resend',
  RESEND_API_KEY: 'k',
  MAIL_FROM: 'Hiflow <no-reply@example.com>',
};

describe('validateEnv', () => {
  it('returns the config when every required variable is present', () => {
    expect(validateEnv(BASE)).toBe(BASE);
  });

  it('names every missing variable in the error', () => {
    expect(() => validateEnv({})).toThrow(
      'Missing required environment variables: DATABASE_URL, JWT_SECRET',
    );
  });

  it('treats an empty string as missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: '' }),
    ).toThrow('JWT_SECRET');
  });

  describe('production', () => {
    it('boots with everything configured, and needs none of it elsewhere', () => {
      expect(() => validateEnv(PRODUCTION)).not.toThrow();
      expect(() =>
        validateEnv({ ...BASE, NODE_ENV: 'development' }),
      ).not.toThrow();
    });

    it('names each protection it is missing', () => {
      expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
        'REDIS_URL, TRUST_PROXY, PROXY_SECRET, TURNSTILE_SECRET',
      );
    });

    it.each(['REDIS_URL', 'TRUST_PROXY', 'PROXY_SECRET', 'TURNSTILE_SECRET'])(
      'refuses to boot without %s',
      (key) => {
        expect(() => validateEnv({ ...PRODUCTION, [key]: '' })).toThrow(key);
      },
    );

    it('refuses local disk, where files would vanish on restart', () => {
      expect(() =>
        validateEnv({ ...PRODUCTION, STORAGE_DRIVER: 'local' }),
      ).toThrow('Production needs STORAGE_DRIVER=supabase');
    });

    it('refuses the outbox mail driver, which never sends anything', () => {
      expect(() =>
        validateEnv({ ...PRODUCTION, MAIL_DRIVER: 'outbox' }),
      ).toThrow('Production needs MAIL_DRIVER=resend');
      expect(() => validateEnv({ ...PRODUCTION, MAIL_DRIVER: '' })).toThrow(
        'Production needs MAIL_DRIVER=resend',
      );
    });
  });

  describe('file storage', () => {
    it('defaults to local disk and accepts it outside production', () => {
      expect(() => validateEnv(BASE)).not.toThrow();
      expect(() =>
        validateEnv({ ...BASE, STORAGE_DRIVER: 'local' }),
      ).not.toThrow();
    });

    it('needs the Supabase address and key when Supabase is chosen', () => {
      expect(() =>
        validateEnv({ ...BASE, STORAGE_DRIVER: 'supabase' }),
      ).toThrow('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    });

    it('rejects an unknown driver', () => {
      expect(() => validateEnv({ ...BASE, STORAGE_DRIVER: 's3' })).toThrow(
        'STORAGE_DRIVER must be',
      );
    });
  });

  describe('mail', () => {
    it('defaults to the outbox outside production', () => {
      expect(() => validateEnv(BASE)).not.toThrow();
      expect(() =>
        validateEnv({ ...BASE, MAIL_DRIVER: 'outbox' }),
      ).not.toThrow();
    });

    it('needs the Resend key and sender when Resend is chosen', () => {
      expect(() => validateEnv({ ...BASE, MAIL_DRIVER: 'resend' })).toThrow(
        'RESEND_API_KEY, MAIL_FROM',
      );
    });

    it('rejects an unknown driver', () => {
      expect(() => validateEnv({ ...BASE, MAIL_DRIVER: 'smtp' })).toThrow(
        'MAIL_DRIVER must be',
      );
    });
  });
});
