import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, setUnauthorizedHandler } from './client';
import { ApiError } from './errors';

function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onUnauthorized: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(() => {});
  });

  it('sends the cookie with the request and never an Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await apiRequest('GET', '/auth/me');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init.credentials).toBe('include');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('serialises a JSON body and sets the content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'x' }));
    await apiRequest('POST', '/jobs', { body: { title: 'Kế toán' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"title":"Kế toán"}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('sends FormData as-is and lets the browser set the multipart boundary', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, {}));
    const form = new FormData();
    form.append('cv', new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    await apiRequest('POST', '/public/jobs/1/applications', { body: form });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('appends the query string and drops empty values', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));
    await apiRequest('GET', '/candidates', {
      query: { page: 2, search: '', status: ['new'] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/candidates?page=2&status=new',
    );
  });

  it('resolves with the parsed body, and undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [1] }));
    await expect(apiRequest('GET', '/x')).resolves.toEqual({ items: [1] });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest('DELETE', '/x')).resolves.toBeUndefined();
  });

  it('turns a 400 with a message array into ApiError messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        statusCode: 400,
        message: ['Tên bắt buộc', 'Email sai'],
      }),
    );
    const error = await apiRequest('POST', '/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      messages: ['Tên bắt buộc', 'Email sai'],
    });
  });

  it('calls the unauthorized handler on 401 and rejects with status 401', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }),
    );
    await expect(apiRequest('GET', '/auth/me')).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps Retry-After as seconds on a 429', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        429,
        { statusCode: 429, message: 'Too many' },
        { 'Retry-After': '45' },
      ),
    );
    await expect(apiRequest('POST', '/auth/login')).rejects.toMatchObject({
      status: 429,
      retryAfter: 45,
    });
  });

  it('reads a 5xx without a JSON body as an error with no messages', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>oops</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    await expect(apiRequest('GET', '/x')).rejects.toMatchObject({
      status: 502,
      messages: [],
    });
  });

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiRequest('GET', '/x')).rejects.toMatchObject({ status: 0 });
  });

  it('lets an aborted request reject with AbortError, not as a network failure', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    await expect(
      apiRequest('GET', '/x', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
