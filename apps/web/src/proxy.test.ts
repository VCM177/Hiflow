// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, isPublicPath, proxy } from './proxy';

function run(path: string, cookie?: string) {
  const request = new NextRequest(`http://web.test${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return proxy(request);
}

describe('proxy', () => {
  it('sends a visitor without a session to login, remembering the page', () => {
    const response = run('/jobs?status=OPEN');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://web.test/login?next=%2Fjobs%3Fstatus%3DOPEN',
    );
  });

  it('lets a visitor with a session cookie through', () => {
    const response = run('/jobs', 'hf_access_token=abc');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not treat another cookie as a session', () => {
    expect(run('/', 'theme=light').status).toBe(307);
  });

  it.each(['/login', '/careers', '/careers/12', '/dev/tokens'])(
    'lets anyone open %s',
    (path) => {
      expect(run(path).headers.get('location')).toBeNull();
    },
  );

  it('does not open pages that merely start like a public one', () => {
    expect(isPublicPath('/loginx')).toBe(false);
    expect(isPublicPath('/careers-admin')).toBe(false);
    expect(run('/loginx').status).toBe(307);
  });

  it('skips /api, Next assets and files in /public', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/api/auth/me')).toBe(false);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
    expect(matcher.test('/jobs')).toBe(true);
    expect(matcher.test('/')).toBe(true);
  });
});
