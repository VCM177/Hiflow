import { overrideEnv } from './env-override';

// Real rate limits, counted in memory, and one trusted proxy hop so the
// X-Forwarded-For header chooses the address the limiter sees.
export const restoreThrottleEnv = overrideEnv({
  THROTTLE_LIMIT_SCALE: '1',
  THROTTLE_STORAGE: 'memory',
  TRUST_PROXY: '1',
});
