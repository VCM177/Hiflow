/** Names of the rate-limit policies a route can opt into. */
export const THROTTLE_POLICY = {
  LOGIN_IP: 'login-ip',
  LOGIN_ACCOUNT: 'login-account',
  PUBLIC_READ_IP: 'public-read-ip',
  PUBLIC_APPLY_IP: 'public-apply-ip',
  /** Not a route guard: the form body is not parsed yet when guards run. */
  PUBLIC_APPLY_EMAIL: 'public-apply-email',
} as const;

export type ThrottlePolicy =
  (typeof THROTTLE_POLICY)[keyof typeof THROTTLE_POLICY];

export const THROTTLE_POLICIES_KEY = 'throttle:policies';
