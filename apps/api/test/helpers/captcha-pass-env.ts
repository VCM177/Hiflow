import { TURNSTILE_ALWAYS_PASSES, withTurnstileSecret } from './captcha-env';

// Imported before helpers/e2e-app (see env-override.ts).
export const restoreCaptchaEnv = withTurnstileSecret(TURNSTILE_ALWAYS_PASSES);
