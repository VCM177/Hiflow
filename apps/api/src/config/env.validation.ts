const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Without these a production instance would run with weaker protection than
// the design assumes, so it refuses to start instead.
const REQUIRED_IN_PRODUCTION = ['REDIS_URL', 'TRUST_PROXY'] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const required =
    config.NODE_ENV === 'production'
      ? [...REQUIRED_ENV, ...REQUIRED_IN_PRODUCTION]
      : REQUIRED_ENV;
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return config;
}
