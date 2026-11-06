import { describe, expect, it } from 'vitest';

import { securityHeaders } from './security-headers';

const byKey = (production: boolean) =>
  Object.fromEntries(securityHeaders(production).map((h) => [h.key, h.value]));

describe('securityHeaders', () => {
  it('forbids framing, sniffing and plugins', () => {
    const headers = byKey(false);
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("base-uri 'self'");
  });

  it('does not block the captcha: no script-src or frame-src', () => {
    const csp = byKey(true)['Content-Security-Policy'];
    expect(csp).not.toContain('script-src');
    expect(csp).not.toContain('frame-src');
    expect(csp).not.toContain('default-src');
  });

  it('turns the camera, microphone and location off', () => {
    expect(byKey(false)['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
  });

  it('asks for HTTPS only in production', () => {
    expect(byKey(false)['Strict-Transport-Security']).toBeUndefined();
    expect(byKey(true)['Strict-Transport-Security']).toContain('max-age=');
  });
});
