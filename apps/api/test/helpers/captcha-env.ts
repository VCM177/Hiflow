import { overrideEnv } from './env-override';

/** Cloudflare's published test secrets: no account needed, real siteverify calls. */
export const TURNSTILE_ALWAYS_PASSES = '1x0000000000000000000000000000000AA';
export const TURNSTILE_ALWAYS_FAILS = '2x0000000000000000000000000000000AA';

/** Turns the captcha on with the given secret; call the returned function to undo. */
export const withTurnstileSecret = (secret: string): (() => void) =>
  overrideEnv({ TURNSTILE_SECRET: secret });
