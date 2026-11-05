import { loginUrlFor } from '@/lib/auth/next-path';
import { buildQueryString, type QueryValue } from './query-string';
import { ApiError, messagesFromBody, parseRetryAfter } from './errors';

/** The web app's proxy path. The Route Handler (B4) forwards it to the API. */
export const API_BASE = '/api';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions {
  /** JSON-serialised, or sent as-is when it is FormData (the browser sets the boundary). */
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

const LOGIN_PATH = '/login';

export function redirectToLogin() {
  if (typeof window === 'undefined') return;
  // On the login page a 401 is a wrong password, not an ended session.
  if (window.location.pathname === LOGIN_PATH) return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(loginUrlFor(next));
}

let onUnauthorized: () => void = redirectToLogin;

/**
 * Sets what happens on a 401 (the session ended). The default sends the user to the
 * login page with `next`. Tests replace it; the app keeps the default.
 */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/**
 * Calls the Hiflow API. The session is an HttpOnly cookie that the browser sends on
 * its own (`credentials: 'include'`); this code never reads or stores a token.
 * Resolves with the parsed JSON body, or undefined for 204. Rejects with ApiError.
 */
export async function apiRequest<TResponse>(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const url = `${API_BASE}${path}${buildQueryString(options.query ?? {})}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const body = options.body;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
      body: payload,
    });
  } catch (cause) {
    // Aborts are the caller's choice, not a network failure.
    if (cause instanceof DOMException && cause.name === 'AbortError')
      throw cause;
    throw new ApiError(0, []);
  }

  if (response.status === 401) {
    onUnauthorized();
    throw new ApiError(401, messagesFromBody(await readBody(response)));
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      messagesFromBody(await readBody(response)),
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  if (response.status === 204) return undefined as TResponse;
  return (await response.json()) as TResponse;
}

/** Reads a JSON error body; anything else (HTML from a proxy, empty) yields undefined. */
async function readBody(response: Response): Promise<unknown> {
  const type = response.headers.get('Content-Type') ?? '';
  if (!type.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
