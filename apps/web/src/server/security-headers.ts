export interface Header {
  key: string;
  value: string;
}

/**
 * Headers every response carries. No `script-src`: Next's inline scripts would need a nonce
 * on every request, and the Turnstile widget loads from Cloudflare; what is restricted here is
 * what needs no nonce and still closes the common holes (framing, injected `<base>`, forms
 * sent elsewhere, plugins). HSTS is for production only, where the site is served over HTTPS.
 */
export function securityHeaders(production: boolean): Header[] {
  const headers: Header[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Content-Security-Policy',
      value:
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    },
  ];
  if (production) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }
  return headers;
}
