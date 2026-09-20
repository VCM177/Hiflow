import { overrideEnv } from './env-override';

export const PROXY_SECRET = 'e2e-proxy-secret-value';
export const ALLOWED_ORIGIN = 'https://hiflow.example';

// A proxy secret and two exact CORS origins, the way production is configured.
export const restoreSecurityEnv = overrideEnv({
  PROXY_SECRET,
  WEB_ORIGIN: `${ALLOWED_ORIGIN},https://admin.hiflow.example`,
});
