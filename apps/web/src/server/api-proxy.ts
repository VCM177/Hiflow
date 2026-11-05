/**
 * Forwards a browser request for `/api/*` to the Hiflow API. The browser only ever
 * talks to this app's origin, so the session cookie stays first-party and the proxy
 * secret never leaves the server.
 */

export interface ApiProxyConfig {
  /** Origin of the API, e.g. http://localhost:4000. Never ends up in the browser. */
  apiOrigin: string;
  /** Sent as x-hiflow-proxy-secret when set. The API answers 404 without it in production. */
  proxySecret?: string;
}

const API_PREFIX = '/api';
const SECRET_HEADER = 'x-hiflow-proxy-secret';

// Headers that describe one network hop, not the message (RFC 9110 section 7.6.1).
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

// Never taken from the browser: the proxy decides them. `x-forwarded-for` is the
// exception: it is set by the platform in front of this app (see forwardedFor).
const SERVER_DECIDED = [
  'host',
  'accept-encoding',
  SECRET_HEADER,
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'forwarded',
  'x-real-ip',
];

function errorResponse(status: number, message: string): Response {
  return Response.json({ statusCode: status, message }, { status });
}

function upstreamUrl(request: Request, apiOrigin: string): URL | null {
  const incoming = new URL(request.url);
  if (
    incoming.pathname !== API_PREFIX &&
    !incoming.pathname.startsWith(`${API_PREFIX}/`)
  ) {
    return null;
  }
  const path = incoming.pathname.slice(API_PREFIX.length);
  // The origin is fixed: the browser chooses a path, never a host. Joining as text,
  // not as a relative URL, so a path like "//host/x" cannot replace the host.
  return new URL(`${apiOrigin.replace(/\/+$/, '')}${path}${incoming.search}`);
}

function upstreamHeaders(request: Request, config: ApiProxyConfig): Headers {
  const headers = new Headers(request.headers);
  for (const name of [...HOP_BY_HOP, ...SERVER_DECIDED]) headers.delete(name);
  if (config.proxySecret) headers.set(SECRET_HEADER, config.proxySecret);
  return headers;
}

function downstreamHeaders(upstream: Response): Headers {
  const headers = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  // fetch already decoded the body, so the encoding and length no longer apply.
  if (headers.has('content-encoding')) {
    headers.delete('content-encoding');
    headers.delete('content-length');
  }
  return headers;
}

function isLoginRequest(request: Request, url: URL): boolean {
  return request.method === 'POST' && url.pathname === '/auth/login';
}

/**
 * The login response carries the token in its body for API clients. The browser
 * already gets it as an HttpOnly cookie, so the body copy would only give scripts
 * a way to read it: drop it here.
 */
async function withoutAccessToken(upstream: Response): Promise<Response> {
  const headers = downstreamHeaders(upstream);
  const type = headers.get('content-type') ?? '';
  if (upstream.status !== 200 || !type.includes('application/json')) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  }
  const body = (await upstream.json()) as Record<string, unknown>;
  delete body.accessToken;
  headers.delete('content-length');
  return new Response(JSON.stringify(body), { status: 200, headers });
}

export async function forwardToApi(
  request: Request,
  config: ApiProxyConfig,
): Promise<Response> {
  const url = upstreamUrl(request, config.apiOrigin);
  if (!url) return errorResponse(404, 'Not Found');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers: upstreamHeaders(request, config),
      // Streamed, never buffered: a CV upload must not sit in memory.
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual',
      cache: 'no-store',
      signal: request.signal,
    } as RequestInit);
  } catch {
    // Aborts by the browser also land here; nobody is left to read the answer.
    return errorResponse(502, 'Không kết nối được tới máy chủ.');
  }

  if (isLoginRequest(request, url)) return withoutAccessToken(upstream);

  const nullBody = upstream.status === 204 || upstream.status === 304;
  return new Response(nullBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamHeaders(upstream),
  });
}

/** Reads the proxy configuration from the server's environment. */
export function apiProxyConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ApiProxyConfig | null {
  const apiOrigin =
    env.API_ORIGIN ??
    (env.NODE_ENV === 'production' ? undefined : 'http://localhost:4000');
  if (!apiOrigin) return null;
  return { apiOrigin, proxySecret: env.PROXY_SECRET || undefined };
}
