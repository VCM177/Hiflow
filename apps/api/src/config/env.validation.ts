const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Without these a production instance would run with weaker protection than
// the design assumes, so it refuses to start instead.
const REQUIRED_IN_PRODUCTION = [
  'REDIS_URL',
  'TRUST_PROXY',
  'PROXY_SECRET',
] as const;

const REQUIRED_FOR_SUPABASE = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const driver =
    typeof config.STORAGE_DRIVER === 'string' && config.STORAGE_DRIVER !== ''
      ? config.STORAGE_DRIVER
      : undefined;

  const required = [
    ...REQUIRED_ENV,
    ...(isProduction ? REQUIRED_IN_PRODUCTION : []),
    ...(driver === 'supabase' ? REQUIRED_FOR_SUPABASE : []),
  ];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (driver !== undefined && driver !== 'local' && driver !== 'supabase') {
    throw new Error(
      `STORAGE_DRIVER must be "local" or "supabase" (got ${driver})`,
    );
  }

  // A container's disk does not survive a restart, so CVs kept on it would vanish.
  if (isProduction && driver !== 'supabase') {
    throw new Error('Production needs STORAGE_DRIVER=supabase');
  }

  return config;
}
