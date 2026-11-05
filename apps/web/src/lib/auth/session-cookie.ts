/**
 * Name of the session cookie the API sets (HttpOnly). The web app never reads its
 * value; `proxy.ts` only checks that it is present to decide where to send a visitor.
 */
export const SESSION_COOKIE = 'hf_access_token';
