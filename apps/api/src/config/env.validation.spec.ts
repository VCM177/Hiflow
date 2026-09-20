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

  it('treats an empty string as missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: '' }),
    ).toThrow('JWT_SECRET');
  });
});
