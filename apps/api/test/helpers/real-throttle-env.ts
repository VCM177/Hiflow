// Import this BEFORE helpers/e2e-app. ConfigModule snapshots process.env at the
// moment AppModule is first imported, so the values must already be in place.
// Real rate limits, counted in memory, and one trusted proxy hop so the
// X-Forwarded-For header chooses the address the limiter sees.
const KEYS = [
  'THROTTLE_LIMIT_SCALE',
  'THROTTLE_STORAGE',
  'TRUST_PROXY',
] as const;

const before = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

process.env.THROTTLE_LIMIT_SCALE = '1';
process.env.THROTTLE_STORAGE = 'memory';
process.env.TRUST_PROXY = '1';

export function restoreThrottleEnv(): void {
  for (const key of KEYS) {
    const value = before[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
