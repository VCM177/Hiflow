const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Without these a production instance would run with weaker protection than
// the design assumes, so it refuses to start instead.
const REQUIRED_IN_PRODUCTION = [
  'REDIS_URL',
  'TRUST_PROXY',
  'PROXY_SECRET',
  'TURNSTILE_SECRET',
] as const;

const REQUIRED_FOR_SUPABASE = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const REQUIRED_FOR_RESEND = ['RESEND_API_KEY', 'MAIL_FROM'] as const;

/** An unset or empty value means "use the default". */
const choiceOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

function assertOneOf(
  name: string,
  value: string | undefined,
  allowed: readonly string[],
): void {
  if (value !== undefined && !allowed.includes(value)) {
    throw new Error(
      `${name} must be ${allowed.map((a) => `"${a}"`).join(' or ')} (got ${value})`,
    );
  }
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const storage = choiceOf(config.STORAGE_DRIVER);
  const mail = choiceOf(config.MAIL_DRIVER);

  const required = [
    ...REQUIRED_ENV,
    ...(isProduction ? REQUIRED_IN_PRODUCTION : []),
    ...(storage === 'supabase' ? REQUIRED_FOR_SUPABASE : []),
    ...(mail === 'resend' ? REQUIRED_FOR_RESEND : []),
  ];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  assertOneOf('STORAGE_DRIVER', storage, ['local', 'supabase']);
  assertOneOf('MAIL_DRIVER', mail, ['outbox', 'resend']);

  // A container's disk does not survive a restart, so CVs kept on it would vanish.
  if (isProduction && storage !== 'supabase') {
    throw new Error('Production needs STORAGE_DRIVER=supabase');
  }
  // The outbox never sends anything: candidates would never get their mail.
  if (isProduction && mail !== 'resend') {
    throw new Error('Production needs MAIL_DRIVER=resend');
  }

  return config;
}
