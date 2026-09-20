/** Names of the rate-limit policies a route can opt into. */
export const THROTTLE_POLICY = {
  LOGIN_IP: 'login-ip',
  LOGIN_ACCOUNT: 'login-account',
} as const;

export type ThrottlePolicy =
  (typeof THROTTLE_POLICY)[keyof typeof THROTTLE_POLICY];

export const THROTTLE_POLICIES_KEY = 'throttle:policies';
