/**
 * Reads TRUST_PROXY for Express: a hop count ("2"), or a preset or subnet
 * ("loopback"). Behind a proxy the client address comes from X-Forwarded-For,
 * and only the hops we trust may be believed, otherwise callers can pick the
 * address the rate limiter sees.
 */
export function parseTrustProxy(
  value: string | undefined,
): boolean | number | string {
  const trimmed = value?.trim() ?? '';

  if (trimmed === '' || trimmed === 'false') return false;

  if (trimmed === 'true') {
    throw new Error(
      'TRUST_PROXY=true trusts every hop, so clients can spoof their address. Use the number of proxies in front of the API instead.',
    );
  }

  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}
