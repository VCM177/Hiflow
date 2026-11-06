import { describe, expect, it } from 'vitest';

import { absoluteUrl, siteUrl } from './site-url';

describe('siteUrl', () => {
  it('uses SITE_URL without a trailing slash', () => {
    expect(siteUrl({ SITE_URL: 'https://tuyendung.example.com/' })).toBe(
      'https://tuyendung.example.com',
    );
  });
  it('falls back to the dev server outside production', () => {
    expect(siteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });
  it('has no address in production without SITE_URL', () => {
    expect(siteUrl({ NODE_ENV: 'production' })).toBeNull();
    expect(siteUrl({ NODE_ENV: 'production', SITE_URL: '  ' })).toBeNull();
  });
});

describe('absoluteUrl', () => {
  it('joins the address and the path', () => {
    expect(absoluteUrl('/careers/x', { SITE_URL: 'https://a.test' })).toBe(
      'https://a.test/careers/x',
    );
  });
  it('leaves the path relative when there is no address', () => {
    expect(absoluteUrl('/careers/x', { NODE_ENV: 'production' })).toBe(
      '/careers/x',
    );
  });
});
