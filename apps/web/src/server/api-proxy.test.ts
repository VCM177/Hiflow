// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiProxyConfigFromEnv, forwardToApi } from './api-proxy';

const config = { apiOrigin: 'http://api.test:4000', proxySecret: 's3cret' };

describe('forwardToApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sent() {
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    return { url, init, headers: init.headers as Headers };
  }

  it('maps /api/<path>?<query> onto the API origin', async () => {
    await forwardToApi(
      new Request('http://web.test/api/jobs/1?page=2&search=a%20b'),
      config,
    );
    expect(sent().url.href).toBe(
      'http://api.test:4000/jobs/1?page=2&search=a%20b',
    );
  });

  it('never lets the browser pick the host', async () => {
    await forwardToApi(
      new Request('http://web.test/api//evil.test/x', {
        headers: { host: 'evil.test' },
      }),
      config,
    );
    expect(sent().url.origin).toBe('http://api.test:4000');
  });

  it('answers 404 for a path outside /api', async () => {
    const response = await forwardToApi(
      new Request('http://web.test/apix/jobs'),
      config,
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds the proxy secret and ignores one sent by the browser', async () => {
    await forwardToApi(
      new Request('http://web.test/api/jobs', {
        headers: { 'x-hiflow-proxy-secret': 'forged' },
      }),
      config,
    );
    expect(sent().headers.get('x-hiflow-proxy-secret')).toBe('s3cret');
  });

  it('sends no secret header when none is configured, and drops a forged one', async () => {
    await forwardToApi(
      new Request('http://web.test/api/jobs', {
        headers: { 'x-hiflow-proxy-secret': 'forged' },
      }),
      { apiOrigin: config.apiOrigin },
    );
    expect(sent().headers.has('x-hiflow-proxy-secret')).toBe(false);
  });

  it('passes the cookie and the visitor address, and drops hop-by-hop and spoofable headers', async () => {
    await forwardToApi(
      new Request('http://web.test/api/jobs', {
        headers: {
          cookie: 'hf_access_token=abc',
          'x-forwarded-for': '203.0.113.7',
          connection: 'keep-alive',
          'x-real-ip': '10.0.0.1',
          forwarded: 'for=10.0.0.1',
          'x-forwarded-host': 'evil.test',
        },
      }),
      config,
    );
    const { headers } = sent();
    expect(headers.get('cookie')).toBe('hf_access_token=abc');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(headers.has('connection')).toBe(false);
    expect(headers.has('x-real-ip')).toBe(false);
    expect(headers.has('forwarded')).toBe(false);
    expect(headers.has('x-forwarded-host')).toBe(false);
  });

  it('streams a request body and keeps the multipart boundary', async () => {
    const form = new FormData();
    form.set(
      'cv',
      new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      'cv.pdf',
    );
    const request = new Request('http://web.test/api/candidates/1/cv', {
      method: 'POST',
      body: form,
    });
    const contentType = request.headers.get('content-type');
    await forwardToApi(request, config);
    const { init, headers } = sent();
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect((init as { duplex?: string }).duplex).toBe('half');
    expect(headers.get('content-type')).toBe(contentType);
  });

  it('sends no body for GET and HEAD', async () => {
    await forwardToApi(new Request('http://web.test/api/jobs'), config);
    expect(sent().init.body).toBeUndefined();
  });

  it('does not follow redirects', async () => {
    await forwardToApi(new Request('http://web.test/api/jobs'), config);
    expect(sent().init.redirect).toBe('manual');
  });

  it('returns status, body and the headers the browser needs', async () => {
    const upstream = new Response('pdf', {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="cv.pdf"',
        'retry-after': '30',
        connection: 'close',
      },
    });
    upstream.headers.append('set-cookie', 'a=1; HttpOnly');
    upstream.headers.append('set-cookie', 'b=2; HttpOnly');
    fetchMock.mockResolvedValueOnce(upstream);

    const response = await forwardToApi(
      new Request('http://web.test/api/candidates/1/cv'),
      config,
    );
    expect(await response.text()).toBe('pdf');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="cv.pdf"',
    );
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.has('connection')).toBe(false);
    expect(response.headers.getSetCookie()).toEqual([
      'a=1; HttpOnly',
      'b=2; HttpOnly',
    ]);
  });

  it('passes an error status and its JSON body through', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ statusCode: 429, message: 'Quá nhanh' }, { status: 429 }),
    );
    const response = await forwardToApi(
      new Request('http://web.test/api/auth/login', { method: 'POST' }),
      config,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      statusCode: 429,
      message: 'Quá nhanh',
    });
  });

  it('keeps 204 empty', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await forwardToApi(
      new Request('http://web.test/api/auth/logout', { method: 'POST' }),
      config,
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('answers 502 in the API error shape when the API is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const response = await forwardToApi(
      new Request('http://web.test/api/jobs'),
      config,
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      statusCode: 502,
      message: 'Không kết nối được tới máy chủ.',
    });
  });

  describe('login', () => {
    const loginResponse = () =>
      new Response(JSON.stringify({ accessToken: 'jwt', user: { id: 'u1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': '40',
          'set-cookie': 'hf_access_token=jwt; HttpOnly',
        },
      });

    it('removes the token from the body but keeps the cookie', async () => {
      fetchMock.mockResolvedValueOnce(loginResponse());
      const response = await forwardToApi(
        new Request('http://web.test/api/auth/login', { method: 'POST' }),
        config,
      );
      expect(await response.json()).toEqual({ user: { id: 'u1' } });
      expect(response.headers.getSetCookie()).toEqual([
        'hf_access_token=jwt; HttpOnly',
      ]);
    });

    it('leaves other routes alone', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ accessToken: 'keep' }, { status: 200 }),
      );
      const response = await forwardToApi(
        new Request('http://web.test/api/auth/me'),
        config,
      );
      expect(await response.json()).toEqual({ accessToken: 'keep' });
    });

    it('passes a failed login through untouched', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json(
          { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' },
          { status: 401 },
        ),
      );
      const response = await forwardToApi(
        new Request('http://web.test/api/auth/login', { method: 'POST' }),
        config,
      );
      expect(response.status).toBe(401);
      expect((await response.json()).message).toBe(
        'Email hoặc mật khẩu không đúng',
      );
    });
  });
});

describe('apiProxyConfigFromEnv', () => {
  it('reads the origin and the secret', () => {
    expect(
      apiProxyConfigFromEnv({
        API_ORIGIN: 'https://api.example.com',
        PROXY_SECRET: 'x',
      }),
    ).toEqual({ apiOrigin: 'https://api.example.com', proxySecret: 'x' });
  });

  it('defaults to localhost outside production', () => {
    expect(apiProxyConfigFromEnv({})).toEqual({
      apiOrigin: 'http://localhost:4000',
      proxySecret: undefined,
    });
  });

  it('refuses to guess the origin in production', () => {
    expect(apiProxyConfigFromEnv({ NODE_ENV: 'production' })).toBeNull();
  });
});
